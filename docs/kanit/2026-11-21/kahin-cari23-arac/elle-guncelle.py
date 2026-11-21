#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Cari kâhini bakımı 23 (§35 Y23-5 — S200 = A, SK-20 alanı kapandı): d35 H8 ve d36 J14 elle tablolarının KARAR GEREĞİ güncellenmesi (adımlar DEĞİŞMEZ; metin düzeni korunur — yalnız ilgili
satırlar). Elle hesap (kâhin koşulmadan, karar metinlerinden):

d35 H8 (bugün 15.04): H8F 600 (01.03) + elle h8x 300 (02.03), kart KH8 500 (15.03; 2 × 250, 01.04 / 01.05) — O 900 > T 500, eşit elle borç yok, E 300 < T → S200 A: kart h8x 300 + H8F'nin 200'ü.
  H8F kendi 600, gösterilen 400, kartta 200, 'Taksitte' değil · h8x Kalan 300 (Y9-7: kuyruk 0 + tüketilen 300) · takvim h8x "yok" (kartın tamamen içine aldığı kalem) · KH8 Kalan 500 ·
  gecikmiş 650 (H8F'nin kartın dışındaki 400'ü, belge 01.03 + 1. taksit 250, vade 01.04 — ikisi de < 15.04) · bakiye 900 (aynen).
d36 J14: aynı + kart tahsilatı 250 (10.04) → kartın ödenen 250'si içine alma sırasıyla (önce h8x) yalnız elle borca, belge tarihi sırasıyla (önce faturanın 200'ü) faturaya ve elle borca düşer → SK-23
  (S125 = C) susması — elleYok AYNEN; elleBelirsiz SK-20 → SK-23 / S200.

  python3 -I elle-guncelle.py <senaryolar klasörü>"""
import json
import os
import sys

D = sys.argv[1]


def degistir(ad, eski, yeni):
    p = os.path.join(D, ad)
    with open(p, encoding="utf-8") as f:
        metin = f.read()
    assert metin.count(eski) == 1, (ad, eski[:80], metin.count(eski))
    metin = metin.replace(eski, yeni)
    json.loads(metin)  # geçerli JSON kalır
    with open(p, "w", encoding="utf-8") as f:
        f.write(metin)


d35 = "d35-c5-s120-elle-borclar.json"
degistir(d35, ', "k1:cari:H8:gecikmis", "k1:kart:KH8:kalan", "k1:hareket:h8x:kalan", "k1:takvim:hareket:h8x", "k1:fatura:H8F:acik"', "")
degistir(d35, '  ["cari H8 tanımsız", "SK-20", "BİLİNEN SINIR", "S123 = C"],\n', "")
degistir(d35, '  "k1:kart:KH8:toplam": 50000,\n',
         '  "k1:kart:KH8:toplam": 50000,\n'
         '  "k1:cari:H8:gecikmis": 65000,\n  "k1:kart:KH8:kalan": 50000,\n  "k1:hareket:h8x:kalan": 30000,\n  "k1:takvim:hareket:h8x": "yok",\n  "k1:fatura:H8F:acik": 60000,\n'
         '  "k1:fatura:H8F:gosterilen": 40000,\n  "k1:fatura:H8F:liste:gosterilen": 40000,\n  "k1:fatura:H8F:kartta": 20000,\n  "k1:fatura:H8F:taksitte": false,\n  "k1:fatura:H8F:liste:taksitte": false,\n')
degistir(d35, 'S123 / S124 / S125 = C — H8 / H3 / H9a)"', 'S123 / S124 / S125 = C — H8 / H3 / H9a); §35 Y23-5 (S200 = A — H8: SK-20 alanı kapandı, elle tablo karar gereği güncellendi)"')
d36 = "d36-c5-s122-kart-odemesi.json"
degistir(d36, '["cari J14 tanımsız", "SK-20", "BİLİNEN SINIR", "S123 = C"]', '["cari J14 tanımsız", "S200", "SK-23", "S125 = C"]')
print("d35 H8: 5 elleYok → değer + 5 yeni gösterim denetimi; d36 J14: elleBelirsiz SK-20 → SK-23")
