#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kâhin bakımı 4 (cari) — S9 KUŞKUSU dökümü: kararın (5) / S9 = A örneği ve türevleri verilen kâhin kopyasında ne veriyor. Program AÇILMAZ; karar metniyle karşılaştırma
KARARLAR.md §16 "S9 kuşkusunun sonucu"nda. Ana oturumun sorusu: "kâhin S9 örneğinde 9.000 veriyor olabilir, karar A'nın sonucu 4.000".

  python3 -I s9-yokla.py --model <cari klasörü (model.py)>

Karar metni (EK-2B K-2 KURAL, öneri A — kullanıcı (5) = A): "Girdi: satış S 01.03 10.000 (vade 31.03), alış P 10.03 6.000 (vade 30.04), t = 15.04 → beklenen gecikmiş 4.000; S listede
'Açık 10.000'"; §4 2B-S4: "Alış 12.000 olsaydı (cari bize 2.000 alacaklı) → A: 0". Beklenen sütunu bu metinden ve S92 = A'dan ELLE yazıldı (kuruş)."""
import importlib.util
import json
import os
import sys

MODEL = os.path.abspath(sys.argv[sys.argv.index("--model") + 1])
spec = importlib.util.spec_from_file_location("kahin_cari_s9", os.path.join(MODEL, "model.py"))
M = importlib.util.module_from_spec(spec)
spec.loader.exec_module(M)
V3 = "destekofis-cari/3"
K = {"id": "k1", "islem": "kontrol", "gecikmis": True, "gorunumToplam": True, "acikToplam": True}
ORNEKLER = [
    ("S9 harfi örnek (elle Borç / Alacak; vadeler karardaki gibi)", [
        {"id": "cm", "islem": "cari_ac", "ad": "M", "isim": "S9 Elle", "tarih": "2026-02-01"},
        {"id": "s", "islem": "borc", "cari": "M", "tutar": "10000", "tarih": "2026-03-01", "vade": "2026-03-31"},
        {"id": "p", "islem": "alacak", "cari": "M", "tutar": "6000", "tarih": "2026-03-10", "vade": "2026-04-30"}, K],
     {"k1:cari:M:gecikmis": 400000, "k1:hareket:s:kalan": 400000, "k1:hareket:p:kalan": 0}),
    ("S9 harfi örnek (satış + alış FATURASI; bu dilde faturanın vadesi belge günü)", [
        {"id": "cm", "islem": "cari_ac", "ad": "M", "isim": "S9 Fatura", "tarih": "2026-02-01"},
        {"id": "fs", "islem": "fatura", "ad": "S", "cari": "M", "tutar": "10000", "tarih": "2026-03-01"},
        {"id": "fp", "islem": "fatura", "ad": "P", "cari": "M", "tur": "alis", "tutar": "6000", "tarih": "2026-03-10"}, K],
     {"k1:cari:M:gecikmis": 400000, "k1:fatura:S:acik": 1000000, "k1:fatura:P:acik": 600000, "k1:takvim:fatura:S": {"amount": 400000, "direction": "in"}, "k1:takvim:fatura:P": "yok"}),
    ("S9 örneği + vadesi GELMEMİŞ ikinci borç 5.000 (vade 30.06) — kuşkunun doğrulandığı hâl", [
        {"id": "cm", "islem": "cari_ac", "ad": "M", "isim": "S9 Artı", "tarih": "2026-02-01"},
        {"id": "s", "islem": "borc", "cari": "M", "tutar": "10000", "tarih": "2026-03-01", "vade": "2026-03-31"},
        {"id": "s2", "islem": "borc", "cari": "M", "tutar": "5000", "tarih": "2026-03-05", "vade": "2026-06-30"},
        {"id": "p", "islem": "alacak", "cari": "M", "tutar": "6000", "tarih": "2026-03-10", "vade": "2026-04-30"}, K],
     {"k1:cari:M:gecikmis": 400000, "k1:hareket:s:kalan": 400000, "k1:hareket:s2:kalan": 500000, "k1:hareket:p:kalan": 0}),
    ("S9 'alış 12.000 olsaydı' dalı (cari bize 2.000 alacaklı)", [
        {"id": "cm", "islem": "cari_ac", "ad": "M", "isim": "S9 Alacaklı", "tarih": "2026-02-01"},
        {"id": "s", "islem": "borc", "cari": "M", "tutar": "10000", "tarih": "2026-03-01", "vade": "2026-03-31"},
        {"id": "p", "islem": "alacak", "cari": "M", "tutar": "12000", "tarih": "2026-03-10", "vade": "2026-04-30"}, K],
     {"k1:cari:M:gecikmis": 0, "k1:hareket:s:kalan": 0, "k1:hareket:p:kalan": 200000}),
    ("5.000 alacağımız + 1.000 iade borcumuz (S92: Kalan / takvim / Vade Takip net 4.000)", [
        {"id": "cm", "islem": "cari_ac", "ad": "M", "isim": "Beş Bin", "tarih": "2026-02-01"},
        {"id": "s", "islem": "borc", "cari": "M", "tutar": "5000", "tarih": "2026-03-01", "vade": "2026-03-31"},
        {"id": "p", "islem": "alacak", "cari": "M", "tutar": "1000", "tarih": "2026-03-10", "vade": "2026-04-10"}, K],
     {"k1:cari:M:gecikmis": 400000, "k1:hareket:s:kalan": 400000, "k1:hareket:p:kalan": 0, "k1:takvim:hareket:p": "yok", "k1:vadeTakip:hareket:s": {"amount": 400000, "date": "2026-03-31", "direction": "in"}}),
]
uyusan = toplam = 0
for ad, adimlar, beklenen in ORNEKLER:
    out = M.Model({"dil": V3, "ad": "s9", "bugun": "2026-04-15", "adimlar": json.loads(json.dumps(adimlar))}, 0, "2.5.0").kos()["denetimler"]
    print("== %s" % ad)
    for k, b in beklenen.items():
        g = out.get(k, {}).get("b", "ANAHTAR YOK")
        toplam += 1
        uyusan += g == b
        print("  %-28s karar metni %-52s kâhin %-52s %s" % (k, json.dumps(b, ensure_ascii=False), json.dumps(g, ensure_ascii=False), "AYNI" if g == b else "FARKLI"))
print("S9 DÖKÜMÜ: %d/%d değer karar metniyle aynı, %d farklı (%s)" % (uyusan, toplam, toplam - uyusan, MODEL))
if "--fark-bekle" in sys.argv:
    # ESKİ kâhin kopyasında koşu (ders 7, 38): karar metninden ayrışan değerler BEKLENİR — döküm kanıttır; çıkış 0 yalnız en az bir fark varsa
    farkli = toplam - uyusan
    print("ESKİ KÂHİN: karar metninden ayrışan %d değer (beklenen: > 0; satırlar yukarıda 'FARKLI')" % farkli)
    print("# tests %d" % farkli)
    print("# pass %d" % farkli)
    print("# fail 0")
    print("%d/%d denetim geçti" % (farkli, farkli) if farkli else "0/1 denetim geçti")
    sys.exit(0 if farkli else 1)
print("# tests %d" % toplam)
print("# pass %d" % uyusan)
print("# fail %d" % (toplam - uyusan))
print("%d/%d denetim geçti" % (uyusan, toplam))
sys.exit(0 if uyusan == toplam else 1)
