#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kâhin bakımı 15: bakım 14'ün d39 / d40 elle tablolarının KARAR GEREĞİ güncellenmesi (adımlar DEĞİŞMEZ; elle değerler karar metninden ve §26'dan elle — kâhin koşulmadan):
- d39: S139 A — şüpheli kayıtlı carilerin gecikmişi artık değerle (elleYok'tan elleBeklenen'e; görünen kalemlerden); S145 A — N11'in 04.06 tarihli tahsilatı (şüpheli 05.06, borç 500 → o tarihte
  borç 200 < 500) RET: bakiye 500, Kalan 500, adım durumu "ret".
- d40: S136 A — Q3 (kararın örneği) gecikmiş 700, Q4 (verilen avans) görünüm değerle; SK-27 `elleBelirsiz` kayıtları kalkar; S137 = C / S138 = C — Q1 / Q1b / Q2 nedeni BİLİNEN SINIR.
  python3 -I d39-d40-guncelle15.py <test/bagimsiz/cari/senaryolar>"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bicim  # noqa: E402

D = sys.argv[1]
K = "k1"


def oku(ad):
    with open(os.path.join(D, ad), encoding="utf-8") as f:
        return json.load(f)


def tk(tutar, tarih, gun, cari, kisi):
    return {"amount": tutar, "dueDate": tarih, "direction": "in", "label": "Tahsil Edilecek Borç", "state": "overdue" if gun < 0 else "today" if gun == 0 else "upcoming", "days": gun,
            "cari": cari, "person": kisi}


def vt(tutar, tarih):
    return {"amount": tutar, "date": tarih, "direction": "in"}


# d39
s = oku("d39-c5-s130-supheli-kalemleri.json")
gec = {"N1": 80000, "N1b": 80000, "N2": 30000, "N3": 20000, "N4": 0, "N5": 20000, "N6": 20000, "N7": 20000, "N8": 20000, "N10": 50000, "N11": 0, "N12": 40000, "N13a": 30000}
for c, v in gec.items():
    anah = "%s:cari:%s:gecikmis" % (K, c)
    assert anah in s["elleYok"], anah
    s["elleYok"].remove(anah)
    s["elleBeklenen"][anah] = v
assert s["elleBeklenen"][K + ":cari:N11:bakiye"] == 20000 and s["elleBeklenen"][K + ":hareket:n11x:kalan"] == 20000
s["elleBeklenen"][K + ":cari:N11:bakiye"] = 50000
s["elleBeklenen"][K + ":hareket:n11x:kalan"] = 50000
s["elleBeklenen"]["adim:n11t:durum"] = "ret"
s["aciklama"] += " · bakım 15: S139 A — şüpheli kayıtlı carilerde gecikmiş görünen kalemlerden (N1 = S139'un kendi örneği: 800); S145 A — N11'in şüpheli tarihinden önceye tahsilatı RET"
s["dayanak"] += ", §26 (Y15-4, Y15-6)"
bicim.yaz(os.path.join(D, "d39-c5-s130-supheli-kalemleri.json"), s)

# d40
s = oku("d40-c5-s130-sus-bilinen-sinir.json")
eski = {json.dumps(x, ensure_ascii=False): x for x in s["elleBelirsiz"]}
yeni_bel = []
for x in s["elleBelirsiz"]:
    if x[0] in ("cari Q3 S130 görünümü tanımsız", "cari Q4 S130 görünümü tanımsız"):
        continue  # S136 A: SK-27 susması kalktı
    if x[0] == "cari Q1 S130 görünümü tanımsız":
        x = ["cari Q1 S130 görünümü tanımsız", "S137 = C", "BİLİNEN SINIR"]
    elif x[0] == "cari Q1b S130 görünümü tanımsız":
        x = ["cari Q1b S130 görünümü tanımsız", "S137 = C"]
    elif x[0] == "cari Q2 S130 görünümü tanımsız":
        x = ["cari Q2 S130 görünümü tanımsız", "S138 = C", "BİLİNEN SINIR"]
    yeni_bel.append(x)
s["elleBelirsiz"] = yeni_bel
kaldir = [K + ":cari:Q3:gecikmis", K + ":takvim:hareket:q4o", K + ":vadeTakip:hareket:q4o", K + ":projeksiyon:hareket:q4o", K + ":takvim:hareket:q4x", K + ":vadeTakip:hareket:q4x",
          K + ":projeksiyon:hareket:q4x", K + ":takvim:cariToplam:Q4", K + ":cari:Q4:gecikmis"]
for anah in kaldir:
    assert anah in s["elleYok"], anah
    s["elleYok"].remove(anah)
kisi = "Kenan Avanslı"
s["elleBeklenen"].update({
    K + ":cari:Q3:gecikmis": 70000,  # S136 kararın örneği: 1. taksit 0, F 500, 2. taksit 200 — hepsinin vadesi geçmiş (bugün 15.06)
    K + ":hareket:q4x:kalan": 50000,
    K + ":takvim:hareket:q4x": tk(20000, "2026-06-01", -14, "Q4", kisi), K + ":vadeTakip:hareket:q4x": vt(20000, "2026-06-01"), K + ":projeksiyon:hareket:q4x": vt(20000, "2026-06-01"),
    K + ":takvim:hareket:q4o": tk(20000, "2026-06-02", -13, "Q4", kisi), K + ":vadeTakip:hareket:q4o": vt(20000, "2026-06-02"), K + ":projeksiyon:hareket:q4o": vt(20000, "2026-06-02"),
    K + ":cari:Q4:gecikmis": 40000, K + ":takvim:cariToplam:Q4": 40000, K + ":vadeTakip:cariToplam:Q4": 40000, K + ":projeksiyon:cariToplam:Q4": 40000})
s["aciklama"] += (" · bakım 15: S136 A — Q3 (kararın örneği: gecikmiş 700, kart göstergeleri değişmez) ve Q4 (verilen avans: Borç 200, avans 200) DEĞERLE; S137 = C / S138 = C — Q1 / Q1b / Q2"
                  " BİLİNEN SINIR")
s["dayanak"] += ", §26 (Y15-1, Y15-2, Y15-10, Y15-11)"
bicim.yaz(os.path.join(D, "d40-c5-s130-sus-bilinen-sinir.json"), s)
print("güncellendi: d39, d40")
