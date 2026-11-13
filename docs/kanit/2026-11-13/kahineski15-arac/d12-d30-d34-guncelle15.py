#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kâhin bakımı 15: BİLİNEN SINIR kararları gereği eski elle tablolarda DEĞER'den SUS'a çevrilen beklentiler (adımlar DEĞİŞMEZ):
- d12 F2 (S149 = C — §26 Y15-16): vade bugün (15.06), Ödeme Sözü 10.06 geçti → takvim kalemi ve gecikmiş yazılmaz.
- d30 KQ1 / KQ3 (S144 = C — §26 Y15-14): kartın kendi tahsilatının fazlası var → kartın 'Tahsil Edilen'i (`odenen`) yazılmaz.
- d34 KE10 (S143 = C — §26 Y15-13): karşı yönlü yükümlülük kalemli (alış faturası) kartlı cari → kartın 'Kalan'ı yazılmaz.
  python3 -I d12-d30-d34-guncelle15.py <test/bagimsiz/cari/senaryolar>"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bicim  # noqa: E402

D = sys.argv[1]
DEG = {"d12-c5-s69-soz-gunu-ve-gecmis.json": (["k1:takvim:hareket:f2", "k1:cari:F2:gecikmis"], [["takvim kalemi f2", "S149 = C"], ["cari F2 gecikmiş tutarı tanımsız", "S149 = C"]]),
       "d30-c5-s101-bitti-kart.json": (["k1:kart:KQ1:odenen", "k1:kart:KQ3:odenen"], [["kart KQ1", "S144 = C"], ["kart KQ3", "S144 = C"]]),
       "d34-c5-s110-kendi-borcu.json": (["k1:kart:KE10:kalan"], [["kart KE10", "S143 = C"]])}
for f, (anahtarlar, belirsiz) in DEG.items():
    p = os.path.join(D, f)
    with open(p, encoding="utf-8") as g:
        s = json.load(g)
    for k in anahtarlar:
        assert k in s["elleBeklenen"], k
        del s["elleBeklenen"][k]
        s.setdefault("elleYok", []).append(k)
    s.setdefault("elleBelirsiz", [])
    s["elleBelirsiz"] += belirsiz
    s["aciklama"] += " · bakım 15: %s — BİLİNEN SINIR (§26), beklenti SUS'a çevrildi" % ", ".join(b[1] for b in belirsiz[:1])
    bicim.yaz(p, s)
print("güncellendi: d12, d30, d34")
