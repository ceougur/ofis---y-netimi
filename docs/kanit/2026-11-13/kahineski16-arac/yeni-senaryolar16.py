#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kâhin bakımı 16 (cari; S155 A — Şüpheli Alacak kuralının ölçüsü TOPLAM borç; S158 A — 'iade tahsilat değildir' her kartta): yeni elle senaryo d44 + d41 / d42'nin karar gereği güncellenmesi.
Elle değerler KARAR METNİNDEN ve KARARLAR.md §27 Y16-1 … Y16-8'den elle hesaplandı (kâhin koşulmadan — ders 40); tutarlar kuruş. Program AÇILMAZ.

  python3 -I yeni-senaryolar16.py <test/bagimsiz/cari/senaryolar>
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bicim  # noqa: E402

D = sys.argv[1]
BUGUN = "2026-06-15"
K = "k1"
KONTROL = {"id": K, "islem": "kontrol", "gecikmis": True, "gorunumToplam": True, "acikToplam": True}
# kararın günleri (bugün 15.06): 60 gün önce 16.04 · 40 gün önce 06.05 · 30 gün önce 16.05 · 10 gün önce 05.06
G60, G40, G30, G10 = "2026-04-16", "2026-05-06", "2026-05-16", "2026-06-05"

A, B, Y, BL = [], {}, [], []
isim = {"X1": "Xavier Sonra Borç Kabul", "X2": "Xenia Örnek Ret", "X3": "Xanthe Çek Ret", "X4": "Ximena Alacak Ret", "X5": "Xaver Borç Silme Ret", "X6": "Xena Borç Yetiyor",
        "X7": "Xiomara Eşit", "X8": "Xerxes Sonra Tahsilat", "X9": "Xylia Bağlı Tahsilat Ret", "X10": "Xandra Geri Yükleme Ret", "X11": "Xyla Stok İade Ret", "X12": "Xavi Fazla Tahsilat",
        "X13": "Xela Kapanmış Kayıt", "X14": "Xilo Tarih Değişikliği", "Y2": "Yağmur Değersiz Kart", "Y4": "Yaman Tahsilat ve İade", "Y5": "Yasin Satış Kartı Değersiz"}
for c in ("X1", "X2", "X3", "X4", "X5", "X6", "X7", "X8", "X9", "X10", "X11", "X12", "X13", "X14"):
    A.append({"id": "c" + c.lower(), "islem": "cari_ac", "ad": c, "isim": isim[c], "tarih": G60})
for c, t in (("Y2", "2026-03-01"), ("Y4", "2026-03-01"), ("Y5", "2026-05-01")):
    A.append({"id": "c" + c.lower(), "islem": "cari_ac", "ad": c, "isim": isim[c], "tarih": t})

# ── S155 kararın iki örneği AYNEN (X1 KABUL, X2 RET) ve komşuları
A += [
    # X1: borç 1.000 (60 gün önce) → şüpheli 900 (30 gün önce) → yeni borç 500 (10 gün önce) → 40 gün önceye tahsilat 300 — KABUL (A' 900, B' 1.200)
    {"id": "x1a", "islem": "borc", "cari": "X1", "tutar": "1000", "tarih": G60},
    {"id": "x1s", "islem": "supheli_al", "ad": "SX1", "cari": "X1", "tutar": "900", "tarih": G30},
    {"id": "x1b", "islem": "borc", "cari": "X1", "tutar": "500", "tarih": G10},
    {"id": "x1t", "islem": "tahsilat", "cari": "X1", "tutar": "300", "tarih": G40},
    # X2: yeni borç yokken aynı tahsilat — RET (B' 700 < A' 900)
    {"id": "x2a", "islem": "borc", "cari": "X2", "tutar": "1000", "tarih": G60},
    {"id": "x2s", "islem": "supheli_al", "ad": "SX2", "cari": "X2", "tutar": "900", "tarih": G30},
    {"id": "x2t", "islem": "tahsilat", "cari": "X2", "tutar": "300", "tarih": G40},
    # X3: aynı örnekte alınan çek (40 gün önce) — RET
    {"id": "x3a", "islem": "borc", "cari": "X3", "tutar": "1000", "tarih": G60},
    {"id": "x3s", "islem": "supheli_al", "ad": "SX3", "cari": "X3", "tutar": "900", "tarih": G30},
    {"id": "x3e", "islem": "evrak", "ad": "EX3", "cari": "X3", "tur": "cek", "tutar": "300", "tarih": G40},
    # X4: aynı örnekte Alacak Yaz (40 gün önce) — RET
    {"id": "x4a", "islem": "borc", "cari": "X4", "tutar": "1000", "tarih": G60},
    {"id": "x4s", "islem": "supheli_al", "ad": "SX4", "cari": "X4", "tutar": "900", "tarih": G30},
    {"id": "x4c", "islem": "alacak", "cari": "X4", "tutar": "300", "tarih": G40},
    # X5: borç 700 + 300 (= 1.000) → şüpheli 900 → 300'lük borç kaydının silinmesi — RET (B' 700 < 900)
    {"id": "x5a", "islem": "borc", "cari": "X5", "tutar": "700", "tarih": G60},
    {"id": "x5b", "islem": "borc", "cari": "X5", "tutar": "300", "tarih": "2026-04-20"},
    {"id": "x5s", "islem": "supheli_al", "ad": "SX5", "cari": "X5", "tutar": "900", "tarih": G30},
    {"id": "x5d", "islem": "hareket_sil", "hareket": "x5b"},
    # X6: borcun yettiği önceye tahsilat — şüpheli 600, tahsilat 300 → B' 700 ≥ 600 KABUL
    {"id": "x6a", "islem": "borc", "cari": "X6", "tutar": "1000", "tarih": G60},
    {"id": "x6s", "islem": "supheli_al", "ad": "SX6", "cari": "X6", "tutar": "600", "tarih": G30},
    {"id": "x6t", "islem": "tahsilat", "cari": "X6", "tutar": "300", "tarih": G40},
    # X7: tam eşitlik — şüpheli 600, tahsilat 400 → B' 600 = A' 600 KABUL
    {"id": "x7a", "islem": "borc", "cari": "X7", "tutar": "1000", "tarih": G60},
    {"id": "x7s", "islem": "supheli_al", "ad": "SX7", "cari": "X7", "tutar": "600", "tarih": G30},
    {"id": "x7t", "islem": "tahsilat", "cari": "X7", "tutar": "400", "tarih": G40},
    # X8: şüpheli tarihinden SONRAKİ tahsilat 300 — KABUL, açık şüpheli 900 → 600
    {"id": "x8a", "islem": "borc", "cari": "X8", "tutar": "1000", "tarih": G60},
    {"id": "x8s", "islem": "supheli_al", "ad": "SX8", "cari": "X8", "tutar": "900", "tarih": G30},
    {"id": "x8t", "islem": "tahsilat", "cari": "X8", "tutar": "300", "tarih": "2026-05-20"},
    # X9: faturaya bağlı tahsilat şüpheliden SONRA — şüpheliden düşmez (ŞÜPHELİ KALAN (b)) → B' 700 < A' 900 RET
    {"id": "fx9", "islem": "fatura", "ad": "FX9", "cari": "X9", "tur": "satis", "tutar": "1000", "tarih": G60},
    {"id": "x9s", "islem": "supheli_al", "ad": "SX9", "cari": "X9", "tutar": "900", "tarih": G30},
    {"id": "x9t", "islem": "tahsilat", "cari": "X9", "tutar": "300", "tarih": "2026-05-20", "fatura": "FX9"},
    # X10: Silinenler'den geri yükleme — alacak 300 (40 gün önce) silinir, şüpheli 900, alacak geri yüklenir → RET
    {"id": "x10a", "islem": "borc", "cari": "X10", "tutar": "1000", "tarih": G60},
    {"id": "x10c", "islem": "alacak", "cari": "X10", "tutar": "300", "tarih": G40},
    {"id": "x10d", "islem": "hareket_sil", "hareket": "x10c"},
    {"id": "x10s", "islem": "supheli_al", "ad": "SX10", "cari": "X10", "tutar": "900", "tarih": G30},
    {"id": "x10g", "islem": "hareket_geri_yukle", "hareket": "x10c"},
    # X11: faturasız stok iadesi (40 gün önce) — RET
    {"id": "x11a", "islem": "borc", "cari": "X11", "tutar": "1000", "tarih": G60},
    {"id": "x11s", "islem": "supheli_al", "ad": "SX11", "cari": "X11", "tutar": "900", "tarih": G30},
    {"id": "x11i", "islem": "stok_iade", "cari": "X11", "tutar": "300", "tarih": G40},
    # X12: SK-35 — bugün tahsilat 1.100: açık şüpheli 0, bakiye −100 → SUS
    {"id": "x12a", "islem": "borc", "cari": "X12", "tutar": "1000", "tarih": G60},
    {"id": "x12s", "islem": "supheli_al", "ad": "SX12", "cari": "X12", "tutar": "900", "tarih": G30},
    {"id": "x12t", "islem": "tahsilat", "cari": "X12", "tutar": "1100", "tarih": BUGUN},
    # X13: kayıt Değersiz 900 ile kapanır (bakiye 100), sonra Alacak Yaz 200 → bakiye −100: açık şüpheli 0 → kural bağlamaz → KABUL (§27 Y16-5 düzeltmesi; ilk elle tabloda SK-35 (b) SUS idi)
    {"id": "x13a", "islem": "borc", "cari": "X13", "tutar": "1000", "tarih": G60},
    {"id": "x13s", "islem": "supheli_al", "ad": "SX13", "cari": "X13", "tutar": "900", "tarih": G30},
    {"id": "x13d", "islem": "degersiz", "supheli": "SX13", "tutar": "900", "tarih": "2026-05-20"},
    {"id": "x13c", "islem": "alacak", "cari": "X13", "tutar": "200", "tarih": "2026-06-01"},
    # X14: alacak 300 şüpheliden sonra (düşer — kabul), sonra tarihi şüpheliden önceye alınır → açık şüpheli 600 → 900, B' 700 → RET
    {"id": "x14a", "islem": "borc", "cari": "X14", "tutar": "1000", "tarih": G60},
    {"id": "x14s", "islem": "supheli_al", "ad": "SX14", "cari": "X14", "tutar": "900", "tarih": G30},
    {"id": "x14c", "islem": "alacak", "cari": "X14", "tutar": "300", "tarih": "2026-05-20"},
    {"id": "x14d", "islem": "hareket_duzenle", "hareket": "x14c", "tarih": G40},
]
B.update({
    "adim:x1s:durum": "ok", "adim:x1t:durum": "ok", "k1:cari:X1:bakiye": 120000, "k1:hareket:x1a:kalan": 70000, "k1:hareket:x1b:kalan": 50000,
    "adim:x2t:durum": "ret", "k1:cari:X2:bakiye": 100000, "k1:hareket:x2a:kalan": 100000, "k1:cari:X2:gecikmis": 10000, "k1:takvim:cariToplam:X2": 10000,
    "k1:projeksiyon:cariToplam:X2": 10000,
    "adim:x3e:durum": "ret", "k1:cari:X3:bakiye": 100000, "k1:hareket:x3a:kalan": 100000, "k1:cari:X3:gecikmis": 10000,
    "adim:x4c:durum": "ret", "k1:cari:X4:bakiye": 100000, "k1:hareket:x4a:kalan": 100000,
    "adim:x5d:durum": "ret", "k1:cari:X5:bakiye": 100000, "k1:hareket:x5a:kalan": 70000, "k1:hareket:x5b:kalan": 30000,
    "adim:x6t:durum": "ok", "k1:cari:X6:bakiye": 70000, "k1:hareket:x6a:kalan": 70000, "k1:cari:X6:gecikmis": 10000, "k1:takvim:cariToplam:X6": 10000,
    "adim:x7t:durum": "ok", "k1:cari:X7:bakiye": 60000, "k1:cari:X7:gecikmis": 0, "k1:takvim:cariToplam:X7": 0,
    "adim:x8t:durum": "ok", "k1:cari:X8:bakiye": 70000, "k1:cari:X8:gecikmis": 10000, "k1:takvim:cariToplam:X8": 10000,
    "adim:x9t:durum": "ret", "k1:cari:X9:bakiye": 100000,
    "adim:x10d:durum": "ok", "adim:x10s:durum": "ok", "adim:x10g:durum": "ret", "k1:cari:X10:bakiye": 100000,
    "adim:x11i:durum": "ret", "k1:cari:X11:bakiye": 100000,
    "adim:x13d:durum": "ok", "adim:x13c:durum": "ok", "k1:cari:X13:bakiye": -10000,
    # X14: x14a'nın Kalan'ı elle tabloya YAZILMADI — ilk elle değer (700) yanlıştı: elle Alacak KS2 gereği borcu kapatmaz (§8 (c); karşı yönlü kalem — C16.2); ilk koşuda kâhin bu anahtarı
    # yazmadı ("ANAHTAR YOK"), elle değer kâhine uydurulmadı, yalnız çıkarıldı (raporda açıkça)
    "adim:x14c:durum": "ok", "adim:x14d:durum": "ret", "k1:cari:X14:bakiye": 70000,
})
Y += ["adim:x12t:durum", "k1:cari:X12:bakiye"]
BL += [["adım x12t", "S155", "SK-35", "KULLANICIYA SORULMALI"]]

# ── S158 komşuları (kararın örneği AYNEN d42 T7'de)
A += [
    # Y2: Borç 900 → kart 900 (3 × 300) → şüpheli 300 → Değersiz 300 (kartın 1. taksitini bağsız kapatır) — 'Tahsil Edilen 0', 'Kalan 600'
    {"id": "y2x", "islem": "borc", "cari": "Y2", "tutar": "900", "tarih": "2026-03-01"},
    {"id": "ky2", "islem": "kart_ac", "ad": "KY2", "cari": "Y2", "tutar": "900", "taksit": 3, "ilkVade": "2026-04-01", "tarih": "2026-03-15", "mevcut": True},
    {"id": "y2s", "islem": "supheli_al", "ad": "SY2", "cari": "Y2", "tutar": "300", "tarih": "2026-04-05"},
    {"id": "y2d", "islem": "degersiz", "supheli": "SY2", "tutar": "300", "tarih": "2026-04-10"},
    # Y4: Borç 900 → kart 900 → Taksit Tahsilatı 300 (1. taksit) → stok iadesi 300 (2. taksit) — 'Tahsil Edilen 300', 'Kalan 300'
    {"id": "y4x", "islem": "borc", "cari": "Y4", "tutar": "900", "tarih": "2026-03-01"},
    {"id": "ky4", "islem": "kart_ac", "ad": "KY4", "cari": "Y4", "tutar": "900", "taksit": 3, "ilkVade": "2026-04-01", "tarih": "2026-03-15", "mevcut": True},
    {"id": "y4k", "islem": "kart_tahsilat", "kayit": "KY4", "tutar": "300", "tarih": "2026-04-05"},
    {"id": "y4i", "islem": "stok_iade", "cari": "Y4", "tutar": "300", "tarih": "2026-04-10"},
    # Y5: satış kartı 1.000 (2 × 500) → şüpheli 400 → Değersiz 400 (bakım 15'te SK-32 SUS) — 'Tahsil Edilen 0', 'Kalan 600'
    {"id": "y5s0", "islem": "stok_satis_taksit", "ad": "KY5", "cari": "Y5", "tutar": "1000", "tarih": "2026-05-01", "taksit": 2, "ilkVade": "2026-06-01"},
    {"id": "y5s", "islem": "supheli_al", "ad": "SY5", "cari": "Y5", "tutar": "400", "tarih": "2026-05-10"},
    {"id": "y5d", "islem": "degersiz", "supheli": "SY5", "tutar": "400", "tarih": "2026-05-12"},
]
B.update({
    "adim:y2d:durum": "ok", "k1:cari:Y2:bakiye": 60000, "k1:kart:KY2:toplam": 90000, "k1:kart:KY2:odenen": 0, "k1:kart:KY2:kalan": 60000,
    "k1:kart:KY2:taksit1:odenen": 0, "k1:kart:KY2:taksit2:odenen": 0, "k1:kart:KY2:taksit3:odenen": 0,
    "k1:cari:Y4:bakiye": 30000, "k1:kart:KY4:odenen": 30000, "k1:kart:KY4:kalan": 30000, "k1:kart:KY4:taksit1:odenen": 30000, "k1:kart:KY4:taksit2:odenen": 0,
    "k1:kart:KY4:taksit3:odenen": 0,
    "adim:y5d:durum": "ok", "k1:cari:Y5:bakiye": 60000, "k1:kart:KY5:toplam": 100000, "k1:kart:KY5:odenen": 0, "k1:kart:KY5:kalan": 60000,
    "k1:kart:KY5:taksit1:odenen": 0, "k1:kart:KY5:taksit2:odenen": 0,
})
s = {"dil": "destekofis-cari/3", "ad": "d44-c5-s155-s158", "bugun": BUGUN,
     "aciklama": "Bakım 16: S155 A — Şüpheli Alacak kuralının ölçüsü TOPLAM borç: kararın iki örneği AYNEN (X1 sonradan doğan borçla KABUL, bakiye 1.200; X2 yeni borç yokken RET, bakiye 1.000), "
                 "aynı örnekte çek (X3), Alacak Yaz (X4), borç silme (X5), stok iadesi (X11), Silinenler'den geri yükleme (X10), tarih değişikliği (X14) RET; faturaya bağlı tahsilat şüpheliden sonra "
                 "(X9) RET; borç yetiyor (X6), tam eşitlik (X7), şüpheliden sonraki tahsilat (X8) KABUL; SK-35 (X12) SUS; kayıtları kapanmış caride avans (X13) KABUL. S158 A — 'iade tahsilat değildir' her kartta: Değersiz (Y2), tahsilat + "
                 "iade (Y4), satış kartında Değersiz (Y5)",
     "dayanak": "KARARLAR.md §27 (Y16-1 … Y16-8), §26 (Y15-6, Y15-7), §8 (ŞÜPHELİ KALAN K1, KS7 (b)), §13 C13.4",
     "elleBeklenen": B, "elleYok": Y, "elleBelirsiz": BL, "adimlar": A + [KONTROL]}
bicim.yaz(os.path.join(D, "d44-c5-s155-s158.json"), s)

# ── d41: S7 / S8 / S9 (bakım 15'te SK-33 / SK-34 SUS) değer alır; R7 SK-30 nedeni S156 = C
p = os.path.join(D, "d41-c5-s136-s139-s145-s148.json")
with open(p, encoding="utf-8") as f:
    s41 = json.load(f)
yeni41 = {"adim:s7e:durum": "ret", "k1:cari:S7:bakiye": 100000, "k1:hareket:s7x:kalan": 100000, "k1:cari:S7:gecikmis": 10000,  # çek 300 (06.05) — B' 700 < A' 900 RET
          "adim:s8t:durum": "ok", "k1:cari:S8:bakiye": 95000,   # 400 + 600 − 50 = 950 ≥ 900 KABUL (o günün borcuna bakılmaz)
          "adim:s9t:durum": "ok", "k1:cari:S9:bakiye": 110000}  # 1.000 + 200 − 100 = 1.100 ≥ 950 KABUL
for k_ in yeni41:
    assert k_ in s41["elleYok"], k_
s41["elleYok"] = [k_ for k_ in s41["elleYok"] if k_ not in yeni41]
s41["elleBeklenen"].update(yeni41)
bl = []
for x in s41["elleBelirsiz"]:
    if x == ["cari R7 S130 görünümü tanımsız", "SK-30", "KULLANICIYA SORULMALI"]:
        bl.append(["cari R7 S130 görünümü tanımsız", "SK-30", "BİLİNEN SINIR (kullanıcı kararı S156 = C) S156"])
    elif x[0] in ("adım s7e", "adım s8t", "adım s9t"):
        continue
    else:
        bl.append(x)
s41["elleBelirsiz"] = bl
s41["aciklama"] += " · bakım 16 (§27): S155 A — S7 (çek) RET, S8 / S9 KABUL (toplam ölçü; SK-33 / SK-34 kalktı); R7 SK-30 → S156 = C"
bicim.yaz(p, s41)

# ── d42: T7 (S158'in kendi örneği) değer alır; SK-31 nedenleri S157 = C
p = os.path.join(D, "d42-c5-s140-s151-satis-karti-iade.json")
with open(p, encoding="utf-8") as f:
    s42 = json.load(f)
yeni42 = {"k1:kart:KT7:odenen": 0, "k1:kart:KT7:taksit1:odenen": 0, "k1:kart:KT7:taksit2:odenen": 0, "k1:kart:KT7:taksit3:odenen": 0}
for k_ in yeni42:
    assert k_ in s42["elleYok"], k_
s42["elleYok"] = [k_ for k_ in s42["elleYok"] if k_ not in yeni42]
s42["elleBeklenen"].update(yeni42)
bl = []
for x in s42["elleBelirsiz"]:
    if x == ["kart KT7", "SK-32"]:
        continue
    if len(x) == 3 and x[2].startswith("SK-31"):
        bl.append(x + ["BİLİNEN SINIR (kullanıcı kararı S157 = C) S157"])
    else:
        bl.append(x)
s42["elleBelirsiz"] = bl
s42["aciklama"] += " · bakım 16 (§27): S158 A — T7 (kararın örneği) 'Tahsil Edilen 0', taksit 'Ödenen' 0 / 0 / 0 (SK-32 kalktı); T4 / T5 / T8 nedeni S157 = C"
bicim.yaz(p, s42)
print("d44 yazıldı: %d elle beklenen, %d elleYok, %d elleBelirsiz · d41 +%d · d42 +%d" % (len(B), len(Y), len(BL), len(yeni41), len(yeni42)))
