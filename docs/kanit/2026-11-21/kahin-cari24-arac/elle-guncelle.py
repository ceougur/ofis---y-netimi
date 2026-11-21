#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Cari kâhini bakımı 24 (§36 Y24-4 — KAPSAM (b)): karar gereği değişen ESKİ elle tablo — d8 B (taksitli faturanın iadesi, bakım 1'den beri C13.4 (11) tanımsız). Elle hesap (kâhin koşulmadan):
F1 600 taksitli (2 × 300; 01.06 / 01.07), 20.05 iade 600 (tamamı) → faturanın kendi kartı vadesi en önce gelen açık taksitten küçülür: 01.06 300 → 0, 01.07 300 → 0 → fatura açığı 0, 15.06 gecikmişi 0
(bakiye 0 aynen). Adımlar DEĞİŞMEZ; dosyanın biçimi korunur (metin değişikliği). Kullanım: python3 -I elle-guncelle.py <senaryolar klasörü>"""
import json
import os
import sys

p = os.path.join(sys.argv[1], "d8-c5-tanimsiz.json")
s = open(p, encoding="utf-8").read()
eski = json.loads(s)


def rep(a, b):
    global s
    assert s.count(a) == 1, a[:60]
    s = s.replace(a, b)


rep("B — taksitli faturanın iadesi (kartın küçülmesi (4) / 2B-S3 Ç7b'de) → fatura açığı denetlenmez.",
    "B — taksitli faturanın iadesi: bakım 24 (§36 Y24-4, KAPSAM (b)) ile TANIMLI — faturanın kendi kartı vadesi en önce gelen açık taksitten küçülür (iade 600 → 2 taksit 0'a): fatura açığı 0, gecikmiş 0 "
    "(önceden kartın küçülmesi (4) Ç7b'ye kaldığı için denetlenmiyordu).")
rep('  "k1:cari:A:gecikmis": 90000\n },\n "elleYok": ["k1:fatura:F1:acik", "k1:cari:B:gecikmis"]',
    '  "k1:cari:A:gecikmis": 90000,\n  "k1:fatura:F1:acik": 0,\n  "k1:cari:B:gecikmis": 0\n },\n "elleYok": []')
yeni = json.loads(s)
assert yeni["adimlar"] == eski["adimlar"]
open(p, "w", encoding="utf-8").write(s)
print("d8 güncellendi")
