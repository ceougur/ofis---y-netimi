#!/usr/bin/env python3
"""Bakım 9: d34-c5-s110-kendi-borcu'nun E11 / E12 / E13 beklentileri S120 A gereği değişir (bakım 8'de SK-19 ile susuyordu; KARARLAR.md §21 Y9-3, tablo "SK-19'un durumları").
Adımlar DEĞİŞMEZ; yalnız E11–E13'ün elleYok / elleBelirsiz kayıtları kalkar, yerine ELLE hesaplanmış değerler girer (kararın üç örneği AYNEN). Öbür beklentiler (E1–E10, E14) DEĞİŞMEZ.
Kullanım: python3 -I d34-guncelle9.py <d34 dosyası>"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bicim  # noqa: E402

p = sys.argv[1]
with open(p, encoding="utf-8") as f:
    s = json.load(f)
K = "k1"
ESKI_YOK = {"k1:fatura:E11F:acik", "k1:hareket:e11x:kalan", "k1:hareket:e11y:kalan", "k1:cari:E11:gecikmis", "k1:kart:KE11:kalan", "k1:takvim:hareket:e11x",
            "k1:fatura:E12F:acik", "k1:cari:E12:gecikmis", "k1:kart:KE12:kalan", "k1:hareket:e12b:kalan",
            "k1:fatura:E13F:acik", "k1:cari:E13:gecikmis", "k1:kart:KE13:kalan", "k1:hareket:e13b:kalan"}
assert ESKI_YOK <= set(s["elleYok"]), "d34 bakım 8 hâlinde değil"
s["elleYok"] = [k for k in s["elleYok"] if k not in ESKI_YOK]
s["elleBelirsiz"] = [b for b in s["elleBelirsiz"] if "SK-19" not in b]


def kalem(tutar, gun, gunler, cari, kisi):
    return {"amount": tutar, "dueDate": gun, "direction": "in", "label": "Tahsil Edilecek Borç", "state": "overdue", "days": gunler, "cari": cari, "person": kisi}


def gorunum(h, tutar, gun, gunler, cari, kisi):
    v = {"amount": tutar, "date": gun, "direction": "in"}
    return {"%s:takvim:hareket:%s" % (K, h): kalem(tutar, gun, gunler, cari, kisi), "%s:vadeTakip:hareket:%s" % (K, h): v, "%s:projeksiyon:hareket:%s" % (K, h): dict(v)}


def yok3(h):
    return {"%s:takvim:hareket:%s" % (K, h): "yok", "%s:vadeTakip:hareket:%s" % (K, h): "yok", "%s:projeksiyon:hareket:%s" % (K, h): "yok"}


def kart(no, toplam, taksit):
    b = {"%s:kart:%s:var" % (K, no): True, "%s:kart:%s:toplam" % (K, no): toplam, "%s:kart:%s:odenen" % (K, no): 0, "%s:kart:%s:kalan" % (K, no): toplam,
         "%s:kart:%s:mevcutBorc" % (K, no): True}
    for i in range(taksit):
        b["%s:kart:%s:taksit%d:odenen" % (K, no, i + 1)] = 0
    return b


yeni = {}
# E11 — kararın 1. örneği AYNEN (SK-19 (a)): 01.03 F 600 · 02.03 X 500 · 05.03 Y 700 (vadesiz) · 15.03 kart 900 ⇒ kartta X 500 + Y'nin 400'ü; açık F 600 + Y 300.
#   X Kalan 500 (0 + 500), Y Kalan 700 (300 + 400) — C13.4 (7) / Y9-7; gecikmiş = F 600 + Y 300 + 1. taksit 300 (01.04) = 1.200; açık toplamı = bakiye 1.800.
yeni.update({"k1:cari:E11:gecikmis": 120000, "k1:cari:E11:acikToplam": 180000, "k1:cari:E11:acikEsitBakiye": True,
             "k1:fatura:E11F:acik": 60000, "k1:takvim:fatura:E11F": {"amount": 60000, "direction": "in"},
             "k1:hareket:e11x:kalan": 50000, "k1:hareket:e11y:kalan": 70000})
yeni.update(yok3("e11x"))
yeni.update(gorunum("e11y", 30000, "2026-03-05", -41, "E11", "Ekin İki Borç"))
yeni.update(kart("KE11", 90000, 3))
# E12 — kararın 2. örneği AYNEN (SK-19 (b); eşit kalem fatura — sayılmaz): 01.03 Borç 900 · 05.03 F 600 · 15.03 kart 600 (2 × 300) ⇒ Borç'un 600'ü kartta; açık Borç 300 + F 600.
#   Borç Kalan 900 (300 + 600); gecikmiş = Borç 300 + F 600 + 1. taksit 300 = 1.200; açık toplamı 1.500.
yeni.update({"k1:cari:E12:gecikmis": 120000, "k1:cari:E12:acikToplam": 150000, "k1:cari:E12:acikEsitBakiye": True,
             "k1:fatura:E12F:acik": 60000, "k1:takvim:fatura:E12F": {"amount": 60000, "direction": "in"}, "k1:hareket:e12b:kalan": 90000})
yeni.update(gorunum("e12b", 30000, "2026-03-01", -45, "E12", "Eray Eşit Fatura"))
yeni.update(kart("KE12", 60000, 2))
# E13 — kararın 3. örneği AYNEN (SK-19 (c)): 01.03 Borç 900 · 05.03 F 600 · 15.03 kart 500 (2 × 250) ⇒ Borç'un 500'ü kartta; açık Borç 400 + F 600.
#   Borç Kalan 900 (400 + 500); gecikmiş = Borç 400 + F 600 + 1. taksit 250 = 1.250; açık toplamı 1.500.
yeni.update({"k1:cari:E13:gecikmis": 125000, "k1:cari:E13:acikToplam": 150000, "k1:cari:E13:acikEsitBakiye": True,
             "k1:fatura:E13F:acik": 60000, "k1:takvim:fatura:E13F": {"amount": 60000, "direction": "in"}, "k1:hareket:e13b:kalan": 90000})
yeni.update(gorunum("e13b", 40000, "2026-03-01", -45, "E13", "Ezgi Parça"))
yeni.update(kart("KE13", 50000, 2))
cakisan = {k: (s["elleBeklenen"][k], v) for k, v in yeni.items() if k in s["elleBeklenen"] and s["elleBeklenen"][k] != v}
assert not cakisan, cakisan  # bakım 8'in yazdığı E11–E13 değerleri (bakiye, kart tutarı) aynen
eklenen = [k for k in yeni if k not in s["elleBeklenen"]]
s["elleBeklenen"].update(yeni)
s["aciklama"] = s["aciklama"].replace("SK-19 (E11–E13, susar)", "SK-19 (E11–E13) — bakım 9 (S120 A): kararın üç örneği AYNEN, değer yazılır")
s["dayanak"] = s["dayanak"].replace("§20 (S110 A; Y8-1 … Y8-6; SK-19)", "§20 (S110 A; Y8-1 … Y8-6; SK-19), §21 (S120 A — E11–E13)")
bicim.yaz(p, s)
print("d34: %d elleYok + %d elleBelirsiz kalktı, %d elle değer eklendi (E11–E13); toplam %d elle denetim" % (
    len(ESKI_YOK), 3, len(eklenen), len(s["elleBeklenen"]) + len(s["elleYok"]) + len(s["elleBelirsiz"])))
