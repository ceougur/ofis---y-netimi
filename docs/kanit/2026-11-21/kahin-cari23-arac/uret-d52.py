#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Cari kâhini bakımı 23 (KARARLAR.md §35) — d52 elle senaryosunu yazar. Elle beklenenler KARAR METİNLERİNDEN elle hesaplandı (kâhin koşulmadan; aşağıdaki hesap satırları), program AÇILMAZ.

  python3 -I uret-d52.py <çıktı.json>

Bugün 16.02.2026; Mevcut Borç kartlarının taksit vadeleri bugünden sonra (01.03 / 07.03) — gecikmiş yalnız kartın dışında kalan fatura kısmından.
P1 S229'un kendi örneği (S200 A: BY 30.000 + F1'in 30.000'i kartta): F1 kendi 50.000, gösterilen 20.000, kartta 30.000, 'Taksitte' değil; gecikmiş 20.000 (S200'ün "16.02'de gecikmiş 20.000"u).
P2 tamamı alınan fatura (O = T): kendi 40.000, gösterilen 0, kartta 40.000, 'Taksitte'.
P3 kısmen tahsil edilmiş fatura (bağlı 20.000), kart kalanının tamamını alır: kendi 30.000, gösterilen 0, kartta 30.000, 'Taksitte'.
P4 iki kart: KP4a FP4a'yı aldı ve tamamen ödendi (kendi 0 → gösterilen 0, kartta 0, durum SUS — Y23-6 (i)); FP4b'yi KP4b aldı (gösterilen 0, kartta 20.000, 'Taksitte').
P5 kartı olmayan fatura (bağlı 4.000): kendi = gösterilen 6.000, kartta 0, 'Taksitte' değil; gecikmiş 6.000.
P6 bir faturayı iki kart bölüyor: KP6a 20.000 (S200, E = 0 — Y23-5 okuması) ödendi; KP6b kalan 30.000'i aldı → kendi 30.000, gösterilen 0, kartta 30.000, 'Taksitte'.
P7 alış faturası (bağlı ödeme 2.000): kendi = gösterilen 3.000, kartta 0, 'Taksitte' değil.
P8 S110 "kendi borcu" (kart TEK eşit elle borcu taşır): fatura kartın dışında — kendi = gösterilen 10.000, kartta 0; gecikmiş 10.000.
P9 S200 iki fatura: elle 10.000 + FP9a 20.000 + FP9b 30.000, kart 25.000 → elle 10.000 + FP9a'nın 15.000'i kartta (eskiden yeniye); FP9a gösterilen 5.000 / kartta 15.000; FP9b gösterilen 30.000 / kartta 0;
   gecikmiş 35.000; bakiye 60.000.
Kasa: P3 20.000 + P4 30.000 + P5 4.000 + P6 20.000 − P7 2.000 = 72.000."""
import json
import sys

A = []


def ca(ad, isim, t="2026-01-02"):
    A.append({"id": "c" + ad.lower(), "islem": "cari_ac", "ad": ad, "isim": isim, "tarih": t})


def fat(ad, cari, tutar, tarih, tur="satis"):
    A.append({"id": ad.lower(), "islem": "fatura", "ad": ad, "cari": cari, "tur": tur, "tutar": tutar, "tarih": tarih})


def kart(ad, cari, tutar, n, ilk, tarih):
    A.append({"id": ad.lower(), "islem": "kart_ac", "ad": ad, "cari": cari, "tutar": tutar, "taksit": n, "ilkVade": ilk, "tarih": tarih, "mevcut": True})


for ad, isim in (("P1", "Pelin Kısmi Kart"), ("P2", "Pınar Tam Kart"), ("P3", "Polat Ödenmiş Tam Kart"), ("P4", "Perihan İki Kart"), ("P5", "Peker Kartsız"),
                 ("P6", "Pakize Faturası Bölünen"), ("P7", "Pars Tedarik"), ("P8", "Pembe Kendi Borcu"), ("P9", "Poyraz İki Fatura")):
    ca(ad, isim)
fat("FP1", "P1", "50000", "2026-01-10")
fat("FP2", "P2", "40000", "2026-01-10")
fat("FP3", "P3", "50000", "2026-01-10")
fat("FP4a", "P4", "30000", "2026-01-10")
fat("FP5", "P5", "10000", "2026-01-10")
fat("FP6", "P6", "50000", "2026-01-10")
fat("FP7", "P7", "5000", "2026-01-10", "alis")
fat("FP8", "P8", "10000", "2026-01-10")
fat("FP9a", "P9", "20000", "2026-01-10")
fat("FP9b", "P9", "30000", "2026-01-12")
A += [
    {"id": "bp9", "islem": "borc", "cari": "P9", "tutar": "10000", "tarih": "2026-01-05"},
    {"id": "bp1", "islem": "borc", "cari": "P1", "tutar": "30000", "tarih": "2026-01-15"},
    {"id": "bp8", "islem": "borc", "cari": "P8", "tutar": "15000", "tarih": "2026-01-15"},
    {"id": "tp3", "islem": "tahsilat", "cari": "P3", "tutar": "20000", "tarih": "2026-01-15", "fatura": "FP3"},
    {"id": "tp5", "islem": "tahsilat", "cari": "P5", "tutar": "4000", "tarih": "2026-01-15", "fatura": "FP5"},
    {"id": "op7", "islem": "odeme", "cari": "P7", "tutar": "2000", "tarih": "2026-01-15", "fatura": "FP7"},
]
kart("KP1", "P1", "60000", 3, "2026-03-01", "2026-02-01")
kart("KP2", "P2", "40000", 2, "2026-03-01", "2026-02-01")
kart("KP3", "P3", "30000", 3, "2026-03-01", "2026-02-01")
kart("KP4a", "P4", "30000", 3, "2026-03-01", "2026-02-01")
kart("KP6a", "P6", "20000", 2, "2026-03-01", "2026-02-01")
kart("KP8", "P8", "15000", 3, "2026-03-01", "2026-02-01")
kart("KP9", "P9", "25000", 5, "2026-03-01", "2026-02-01")
A += [
    {"id": "ktp4a", "islem": "kart_tahsilat", "kayit": "KP4a", "tutar": "30000", "tarih": "2026-02-05"},
    {"id": "ktp6a", "islem": "kart_tahsilat", "kayit": "KP6a", "tutar": "20000", "tarih": "2026-02-05"},
]
fat("FP4b", "P4", "20000", "2026-02-06")
kart("KP4b", "P4", "20000", 2, "2026-03-07", "2026-02-07")
kart("KP6b", "P6", "30000", 3, "2026-03-07", "2026-02-07")
A.append({"id": "k1", "islem": "kontrol", "gecikmis": True, "acikToplam": True})

TL = 100  # kuruş


def fatura_beklenen(ad, kendi, gosterilen, kartta, taksitte):
    out = {"k1:fatura:%s:acik" % ad: kendi * TL, "k1:fatura:%s:gosterilen" % ad: gosterilen * TL, "k1:fatura:%s:liste:gosterilen" % ad: gosterilen * TL,
           "k1:fatura:%s:kartta" % ad: kartta * TL}
    if taksitte is not None:
        out["k1:fatura:%s:taksitte" % ad] = taksitte
        out["k1:fatura:%s:liste:taksitte" % ad] = taksitte
    return out


EB = {}
for adim in A:
    EB["adim:%s:durum" % adim["id"]] = "ok" if adim["islem"] != "kontrol" else None
EB = {k: v for k, v in EB.items() if v}
# hesap (karar metinlerinden; kuruş = TL × 100)
EB.update(fatura_beklenen("FP1", 50000, 20000, 30000, False))   # S229 örneği: kart BP1 30.000 + FP1 30.000 (S200 A)
EB.update(fatura_beklenen("FP2", 40000, 0, 40000, True))        # O = T, kart tamamını aldı
EB.update(fatura_beklenen("FP3", 30000, 0, 30000, True))        # 50.000 − bağlı 20.000 = 30.000, kart tamamını aldı
EB.update(fatura_beklenen("FP4a", 0, 0, 0, None))               # kartın aldığı kısım ödendi — durum SUS (Y23-6 (i))
EB.update(fatura_beklenen("FP4b", 20000, 0, 20000, True))       # ikinci kart tamamını aldı (ilk kartın taksitleri ödenmiş → O = T)
EB.update(fatura_beklenen("FP5", 6000, 6000, 0, False))         # kartsız
EB.update(fatura_beklenen("FP6", 30000, 0, 30000, True))        # KP6a 20.000 (ödendi) + KP6b 30.000
EB.update(fatura_beklenen("FP7", 3000, 3000, 0, False))         # alış
EB.update(fatura_beklenen("FP8", 10000, 10000, 0, False))       # S110 kendi borcu — fatura kartın dışında
EB.update(fatura_beklenen("FP9a", 20000, 5000, 15000, False))   # S200: elle 10.000 + FP9a'nın 15.000'i
EB.update(fatura_beklenen("FP9b", 30000, 30000, 0, False))      # kart almadı
for c, bakiye, gecikmis in (("P1", 80000, 20000), ("P2", 40000, 0), ("P3", 30000, 0), ("P4", 20000, 0), ("P5", 6000, 6000), ("P6", 30000, 0), ("P7", -3000, 0),
                            ("P8", 25000, 10000), ("P9", 60000, 35000)):
    EB["k1:cari:%s:bakiye" % c] = bakiye * TL
    EB["k1:cari:%s:gecikmis" % c] = gecikmis * TL
    EB["k1:cari:%s:acikToplam" % c] = bakiye * TL
    EB["k1:cari:%s:acikEsitBakiye" % c] = True
EB["k1:hareket:bp1:kalan"] = 30000 * TL   # Y9-7: kartın tamamen içine aldığı elle borcun Kalan'ı (defter kalanı)
EB["k1:hareket:bp9:kalan"] = 10000 * TL
EB["k1:hareket:bp8:kalan"] = 15000 * TL
for no, toplam, odenen in (("KP1", 60000, 0), ("KP2", 40000, 0), ("KP3", 30000, 0), ("KP4a", 30000, 30000), ("KP4b", 20000, 0), ("KP6a", 20000, 20000), ("KP6b", 30000, 0),
                           ("KP8", 15000, 0), ("KP9", 25000, 0)):
    EB["k1:kart:%s:toplam" % no] = toplam * TL
    EB["k1:kart:%s:kalan" % no] = (toplam - odenen) * TL
EB["k1:kasa"] = 72000 * TL

s = {"dil": "destekofis-cari/3", "ad": "d52-c5-s229-s230-gosterilen-acik",
     "aciklama": "Bakım 23 (§35): S229 = A / S230 = A — Mevcut Borç kartının içine aldığı faturanın GÖSTERİLEN açığı (fatura kartı ve Faturalar listesi) = kendi açığı − kartın aldığı kısım; kart tamamını aldıysa 0 ve 'Taksitte'"
                 " (P2, P3, P4b, P6); kısmen aldıysa kalan kısım (P1 — S229'un kendi örneği, P9); kartın almadığı fatura kendi açığıyla (P5, P7, P8, P9b). S200 = A — kart önce elle borçları, eksik kısmı faturalardan"
                 " eskiden yeniye (P1, P9; E = 0 okuması P6). Faturanın KENDİ açığı (kapama kuralıyla) değişmez.",
     "dayanak": "KARARLAR.md §35 (Y23-2 … Y23-6), §21 (Y9-2, Y9-7), §20 (Y8-4), §13 (C13.4, C13.5)", "bugun": "2026-02-16", "adimlar": A,
     "elleBeklenen": EB,
     "elleYok": ["k1:fatura:FP4a:taksitte", "k1:fatura:FP4a:liste:taksitte"],
     "elleBelirsiz": [["fatura FP4a", "Y23-6 (i)"]]}
with open(sys.argv[1], "w", encoding="utf-8") as f:
    json.dump(s, f, ensure_ascii=False, indent=1)
    f.write("\n")
