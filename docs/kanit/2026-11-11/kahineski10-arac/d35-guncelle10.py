#!/usr/bin/env python3
"""Bakım 10: d35-c5-s120-elle-borclar'ın H10 / H11 beklentileri S122 A gereği değişir (bakım 9'da SK-21 ile susuyordu; KARARLAR.md §22 Y10-1 / Y10-2); H3 / H8 / H9a'nın `belirsiz` kaydı
artık "BİLİNEN SINIR (S124 / S123 / S125 = C)" taşır (Y10-6 — susma AYNEN, yalnız neden metni). Adımlar DEĞİŞMEZ; öbür beklentiler (H1, H2, H4a … H9b, H12 … H15b) DEĞİŞMEZ.
Bütün yeni değerler ELLE — kâhin koşulmadan, karar metninden.
Kullanım: python3 -I d35-guncelle10.py <d35 dosyası>"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bicim  # noqa: E402

p = sys.argv[1]
with open(p, encoding="utf-8") as f:
    s = json.load(f)
K = "k1"
ESKI_YOK = set()
for c, kn, hs in (("H10", "KH10", ("h10x", "h10y")), ("H11", "KH11", ("h11x", "h11y"))):
    ESKI_YOK |= {"k1:cari:%s:gecikmis" % c, "k1:kart:%s:kalan" % kn, "k1:takvim:hareket:%s" % hs[0], "k1:fatura:%sF:acik" % c} | {"k1:hareket:%s:kalan" % h for h in hs}
assert ESKI_YOK <= set(s["elleYok"]), "d35 bakım 9 hâlinde değil"
s["elleYok"] = [k for k in s["elleYok"] if k not in ESKI_YOK]
eski_bel = [["cari H10 tanımsız", "SK-21"], ["cari H11 tanımsız", "SK-21"]]
assert all(b in s["elleBelirsiz"] for b in eski_bel)
s["elleBelirsiz"] = [b for b in s["elleBelirsiz"] if b not in eski_bel]
# Y10-6: susma AYNEN, neden "BİLİNEN SINIR (kullanıcı kararı S12x = C)"
ek = {"cari H3 tanımsız": ["BİLİNEN SINIR", "S124 = C"], "cari H8 tanımsız": ["BİLİNEN SINIR", "S123 = C"], "cari H9a tanımsız": ["BİLİNEN SINIR", "S125 = C"]}
yeni_bel = []
for b in s["elleBelirsiz"]:
    if isinstance(b, list) and b[0] in ek:
        b = b + ek.pop(b[0])
    yeni_bel.append(b)
assert not ek, ek
s["elleBelirsiz"] = yeni_bel


def kalem(tutar, gun, gunler, cari, kisi):
    return {"amount": tutar, "dueDate": gun, "direction": "in", "label": "Tahsil Edilecek Borç", "state": "overdue", "days": gunler, "cari": cari, "person": kisi}


def gorunum(h, tutar, gun, gunler, cari, kisi):
    v = {"amount": tutar, "date": gun, "direction": "in"}
    return {"%s:takvim:hareket:%s" % (K, h): kalem(tutar, gun, gunler, cari, kisi), "%s:vadeTakip:hareket:%s" % (K, h): v, "%s:projeksiyon:hareket:%s" % (K, h): dict(v)}


def yok3(h):
    return {"%s:takvim:hareket:%s" % (K, h): "yok", "%s:vadeTakip:hareket:%s" % (K, h): "yok", "%s:projeksiyon:hareket:%s" % (K, h): "yok"}


def kart(no, toplam, odenen, taksitler):
    b = {"%s:kart:%s:var" % (K, no): True, "%s:kart:%s:toplam" % (K, no): toplam, "%s:kart:%s:odenen" % (K, no): odenen, "%s:kart:%s:kalan" % (K, no): toplam - odenen,
         "%s:kart:%s:mevcutBorc" % (K, no): True}
    for i, v in enumerate(taksitler):
        b["%s:kart:%s:taksit%d:odenen" % (K, no, i + 1)] = v
    return b


yeni = {}
# H10 — kararın örneği + 10.04 bağsız tahsilat 1.200 (S2 + S50: F 600 → Y'nin açık 300'ü → taksit 1 300): kartın ödeneni 300 (S50 payı — Y10-2) ⇒ X'e (eskiden yeniye, Y10-1).
#   X Kalan 0 + 500 − 300 = 200; Y Kalan 0 + 400 − 0 = 400; F 0. gecikmiş 0 (F, Y kuyrukta 0; taksit 1 ödendi; taksit 2 01.05); bakiye 600 = açık (0 + 200 + 400). (S122 B: X 500, Y 100.)
yeni.update({"k1:cari:H10:gecikmis": 0, "k1:cari:H10:acikToplam": 60000, "k1:cari:H10:acikEsitBakiye": True,
             "k1:fatura:H10F:acik": 0, "k1:takvim:fatura:H10F": "yok", "k1:hareket:h10x:kalan": 20000, "k1:hareket:h10y:kalan": 40000})
yeni.update(yok3("h10x"))
yeni.update(yok3("h10y"))
yeni.update(kart("KH10", 90000, 30000, [30000, 0, 0]))
# H11 — kararın örneği AYNEN: + 10.04 kart tahsilatı 300 (taksit 1) ⇒ X Kalan 200, Y Kalan 700 (kararın sonucu). gecikmiş F 600 + Y 300 = 900; bakiye 1.500 = açık (600 + 200 + 700).
yeni.update({"k1:cari:H11:gecikmis": 90000, "k1:cari:H11:acikToplam": 150000, "k1:cari:H11:acikEsitBakiye": True,
             "k1:fatura:H11F:acik": 60000, "k1:takvim:fatura:H11F": {"amount": 60000, "direction": "in"}, "k1:hareket:h11x:kalan": 20000, "k1:hareket:h11y:kalan": 70000})
yeni.update(yok3("h11x"))
yeni.update(gorunum("h11y", 30000, "2026-03-05", -41, "H11", "Hacer Kart Öder"))
yeni.update(kart("KH11", 90000, 30000, [30000, 0, 0]))
cakisan = {k: (s["elleBeklenen"][k], v) for k, v in yeni.items() if k in s["elleBeklenen"] and s["elleBeklenen"][k] != v}
assert not cakisan, cakisan  # bakım 9'un yazdığı H10 / H11 değerleri (bakiye, kart tutarı) aynen
eklenen = [k for k in yeni if k not in s["elleBeklenen"]]
s["elleBeklenen"].update(yeni)
s["aciklama"] = s["aciklama"].replace("kart ödemeli (H10, H11 SK-21 susar)", "kart ödemeli (H10 S50 payı, H11 kart tahsilatı — bakım 10 S122 A: değer)")
s["dayanak"] = s["dayanak"] + "; §22 (S122 A — H10 / H11; S123 / S124 / S125 = C — H8 / H3 / H9a)"
bicim.yaz(p, s)
print("d35: %d elleYok + %d elleBelirsiz kalktı, %d elle değer eklendi (H10 / H11), 3 elleBelirsiz'e BİLİNEN SINIR parçası eklendi; toplam %d elle denetim" % (
    len(ESKI_YOK), len(eski_bel), len(eklenen), len(s["elleBeklenen"]) + len(s["elleYok"]) + len(s["elleBelirsiz"])))
