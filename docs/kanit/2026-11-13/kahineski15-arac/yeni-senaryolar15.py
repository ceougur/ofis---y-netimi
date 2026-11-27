#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kâhin bakımı 15 (cari; TOPLU — S136 / S139 / S140 / S145 / S151 A/B, S148 onay, S141 / S143 / S144 / S149 = C): yeni elle senaryolar d41 / d42 / d43. Elle değerler KARAR METNİNDEN ve KARARLAR.md
§26 Y15-1 … Y15-16'dan elle hesaplandı (kâhin koşulmadan — ders 40); tutarlar kuruş. Program AÇILMAZ.

  python3 -I yeni-senaryolar15.py <test/bagimsiz/cari/senaryolar>
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bicim  # noqa: E402

D = sys.argv[1]
BUGUN = "2026-06-15"
K = "k1"
KONTROL = {"id": K, "islem": "kontrol", "gecikmis": True, "gorunumToplam": True, "acikToplam": True}


def tk(tutar, tarih, gun, cari, kisi, soz=False, yon="in"):
    """takvim / zil kalemi (K6.3) — gün: tarih − bugün."""
    return {"amount": tutar, "dueDate": tarih, "direction": yon, "label": ("Tahsil Edilecek Borç" if yon == "in" else "Ödenecek Borç") + (" (Ödeme Sözü)" if soz else ""),
            "state": "overdue" if gun < 0 else "today" if gun == 0 else "upcoming", "days": gun, "cari": cari, "person": kisi}


def vt(tutar, tarih, yon="in"):
    return {"amount": tutar, "date": tarih, "direction": yon}


def yaz(ad, aciklama, dayanak, adimlar, beklenen, yok, belirsiz):
    s = {"dil": "destekofis-cari/3", "ad": ad, "bugun": BUGUN, "aciklama": aciklama, "dayanak": dayanak, "elleBeklenen": beklenen, "elleYok": yok, "elleBelirsiz": belirsiz,
         "adimlar": adimlar + [KONTROL]}
    bicim.yaz(os.path.join(D, ad + ".json"), s)


# ───────────────────────── d41: S136 (taksit / taksitli fatura / avans), S139, S145, S148
A, B, Y, BL = [], {}, [], []
isim = {"R2": "Rıza Taksit Biter", "R3": "Recep Faturaya Geçer", "R4": "Reşat Taksitli Fatura", "R5": "Rana Avanslı", "R7": "Remzi Taksit Tahsilatı", "V1": "Veli Gecikmiş Biter",
        "S1": "Sabri Örnek Ret", "S2": "Sadi Bugün Tahsil", "S3": "Saim Aynı Gün", "S4": "Sait Borç Yetiyor", "S5": "Salim Eşit", "S6": "Samet Taksit Ret", "S7": "Sami Çek",
        "S8": "Saniye Önceden Aşım", "S9": "Sevda Aynı Gün Borç", "W1": "Vedat Söz İleride"}
for c, t in (("R2", "2026-04-01"), ("R3", "2026-04-01"), ("R7", "2026-04-01"), ("S1", "2026-04-01"), ("S2", "2026-04-01"), ("S3", "2026-04-01"), ("S4", "2026-04-01"), ("S5", "2026-04-01"),
             ("S6", "2026-04-01"), ("S7", "2026-04-01"), ("R4", "2026-05-01"), ("R5", "2026-06-01"), ("V1", "2026-06-01"), ("S8", "2026-06-01"), ("S9", "2026-06-01"), ("W1", "2026-06-01")):
    A.append({"id": "c" + c.lower(), "islem": "cari_ac", "ad": c, "isim": isim[c], "tarih": t})
# R2 / R3 / R7: kararın örneğinin komşuları (kart 01.04 Borç 400 → 15.04 kart 400 = 2 × 200 (01.05, 01.06) → 10.05 F 600 → 20.05 şüpheli)
for c in ("R2", "R3", "R7", "S1", "S2", "S3", "S4", "S5", "S6", "S7"):
    pass
A += [{"id": "r2x", "islem": "borc", "cari": "R2", "tutar": "400", "tarih": "2026-04-01"},
      {"id": "r3x", "islem": "borc", "cari": "R3", "tutar": "400", "tarih": "2026-04-01"},
      {"id": "r7x", "islem": "borc", "cari": "R7", "tutar": "400", "tarih": "2026-04-01"},
      {"id": "s1x", "islem": "borc", "cari": "S1", "tutar": "1000", "tarih": "2026-04-01"},
      {"id": "s2x", "islem": "borc", "cari": "S2", "tutar": "1000", "tarih": "2026-04-01"},
      {"id": "s3x", "islem": "borc", "cari": "S3", "tutar": "1000", "tarih": "2026-04-01"},
      {"id": "s4x", "islem": "borc", "cari": "S4", "tutar": "1000", "tarih": "2026-04-01"},
      {"id": "s5x", "islem": "borc", "cari": "S5", "tutar": "1000", "tarih": "2026-04-01"},
      {"id": "s6x", "islem": "borc", "cari": "S6", "tutar": "400", "tarih": "2026-04-01"},
      {"id": "s7x", "islem": "borc", "cari": "S7", "tutar": "1000", "tarih": "2026-04-01"},
      {"id": "kr2", "islem": "kart_ac", "ad": "KR2", "cari": "R2", "tutar": "400", "taksit": 2, "ilkVade": "2026-05-01", "tarih": "2026-04-15", "mevcut": True},
      {"id": "kr3", "islem": "kart_ac", "ad": "KR3", "cari": "R3", "tutar": "400", "taksit": 2, "ilkVade": "2026-05-01", "tarih": "2026-04-15", "mevcut": True},
      {"id": "kr7", "islem": "kart_ac", "ad": "KR7", "cari": "R7", "tutar": "400", "taksit": 2, "ilkVade": "2026-05-01", "tarih": "2026-04-15", "mevcut": True},
      {"id": "ks6", "islem": "kart_ac", "ad": "KS6", "cari": "S6", "tutar": "400", "taksit": 2, "ilkVade": "2026-05-01", "tarih": "2026-04-15", "mevcut": True},
      # R4: taksitli satış faturası (S99) 400 = 2 × 200 (01.05, 01.06) + elle Borç 300 (vade 20.06)
      {"id": "r4f", "islem": "fatura", "ad": "R4F", "cari": "R4", "tutar": "400", "tarih": "2026-05-01", "taksit": {"sayi": 2, "ilkVade": "2026-05-01"}},
      {"id": "r4x", "islem": "borc", "cari": "R4", "tutar": "300", "tarih": "2026-05-02", "vade": "2026-06-20"},
      {"id": "r2f", "islem": "fatura", "ad": "R2F", "cari": "R2", "tutar": "600", "tarih": "2026-05-10"},
      {"id": "r3f", "islem": "fatura", "ad": "R3F", "cari": "R3", "tutar": "600", "tarih": "2026-05-10"},
      {"id": "r7f", "islem": "fatura", "ad": "R7F", "cari": "R7", "tutar": "600", "tarih": "2026-05-10"},
      {"id": "s1s", "islem": "supheli_al", "ad": "SS1", "cari": "S1", "tutar": "900", "tarih": "2026-05-16"},
      {"id": "s2s", "islem": "supheli_al", "ad": "SS2", "cari": "S2", "tutar": "900", "tarih": "2026-05-16"},
      {"id": "s3s", "islem": "supheli_al", "ad": "SS3", "cari": "S3", "tutar": "900", "tarih": "2026-05-16"},
      {"id": "s4s", "islem": "supheli_al", "ad": "SS4", "cari": "S4", "tutar": "500", "tarih": "2026-05-16"},
      {"id": "s5s", "islem": "supheli_al", "ad": "SS5", "cari": "S5", "tutar": "700", "tarih": "2026-05-16"},
      {"id": "s7s", "islem": "supheli_al", "ad": "SS7", "cari": "S7", "tutar": "900", "tarih": "2026-05-16"},
      {"id": "s1t", "islem": "tahsilat", "cari": "S1", "tutar": "300", "tarih": "2026-05-06"},   # S145 kararın örneği: 40 gün önceye — RET
      {"id": "s3t", "islem": "tahsilat", "cari": "S3", "tutar": "300", "tarih": "2026-05-16"},   # aynı gün — kabul
      {"id": "s4t", "islem": "tahsilat", "cari": "S4", "tutar": "300", "tarih": "2026-05-06"},   # öncesi ama borç yetiyor — kabul
      {"id": "s5t", "islem": "tahsilat", "cari": "S5", "tutar": "300", "tarih": "2026-05-06"},   # tam eşitlik — kabul
      {"id": "s7e", "islem": "evrak", "ad": "ES7", "cari": "S7", "tur": "cek", "tutar": "300", "tarih": "2026-05-06"},  # SK-33: tahsilat dışı — SUS
      {"id": "r2s", "islem": "supheli_al", "ad": "SR2", "cari": "R2", "tutar": "200", "tarih": "2026-05-20"},
      {"id": "r3s", "islem": "supheli_al", "ad": "SR3", "cari": "R3", "tutar": "500", "tarih": "2026-05-20"},
      {"id": "r7s", "islem": "supheli_al", "ad": "SR7", "cari": "R7", "tutar": "300", "tarih": "2026-05-20"},
      {"id": "s6s", "islem": "supheli_al", "ad": "SS6", "cari": "S6", "tutar": "400", "tarih": "2026-05-20"},
      {"id": "s6k", "islem": "kart_tahsilat", "kayit": "KS6", "tutar": "200", "tarih": "2026-05-10"},  # Taksit Tahsilatı şüpheliden önceye — RET
      {"id": "r7k", "islem": "kart_tahsilat", "kayit": "KR7", "tutar": "200", "tarih": "2026-05-25"},  # SK-30
      {"id": "r5x", "islem": "borc", "cari": "R5", "tutar": "200", "tarih": "2026-06-01"},
      {"id": "v1x", "islem": "borc", "cari": "V1", "tutar": "300", "tarih": "2026-06-01"},
      {"id": "s8a", "islem": "borc", "cari": "S8", "tutar": "400", "tarih": "2026-06-01"},
      {"id": "s9a", "islem": "borc", "cari": "S9", "tutar": "1000", "tarih": "2026-06-01"},
      {"id": "w1x", "islem": "borc", "cari": "W1", "tutar": "100", "tarih": "2026-06-01", "vade": "2026-06-05", "beklenen": "2026-06-30"},  # S148
      {"id": "r5o", "islem": "odeme", "cari": "R5", "tutar": "300", "tarih": "2026-06-02"},
      {"id": "v1y", "islem": "borc", "cari": "V1", "tutar": "400", "tarih": "2026-06-02", "vade": "2026-06-30"},
      {"id": "r5s", "islem": "supheli_al", "ad": "SR5", "cari": "R5", "tutar": "400", "tarih": "2026-06-05"},
      {"id": "r4s", "islem": "supheli_al", "ad": "SR4", "cari": "R4", "tutar": "300", "tarih": "2026-06-05"},
      {"id": "v1s", "islem": "supheli_al", "ad": "SV1", "cari": "V1", "tutar": "300", "tarih": "2026-06-05"},
      {"id": "s9b", "islem": "borc", "cari": "S9", "tutar": "200", "tarih": "2026-06-10"},
      {"id": "s9s", "islem": "supheli_al", "ad": "SS9", "cari": "S9", "tutar": "950", "tarih": "2026-06-10"},
      {"id": "s9t", "islem": "tahsilat", "cari": "S9", "tutar": "100", "tarih": "2026-06-05"},   # SK-34 (b)
      {"id": "s8b", "islem": "borc", "cari": "S8", "tutar": "600", "tarih": "2026-06-12"},
      {"id": "s8s", "islem": "supheli_al", "ad": "SS8", "cari": "S8", "tutar": "900", "tarih": "2026-06-10"},
      {"id": "s8t", "islem": "tahsilat", "cari": "S8", "tutar": "50", "tarih": "2026-06-05"},    # SK-34 (a)
      {"id": "s2t", "islem": "tahsilat", "cari": "S2", "tutar": "300", "tarih": "2026-06-15"}]   # S145 kararın 'bugün' örneği — kabul
# R2: şüpheli 200 → 1. taksit tam biter: t1 0, F 600, t2 200 → gecikmiş 800 (bugün 15.06; hepsinin vadesi geçti)
for c, kart, f, gec in (("R2", "KR2", "R2F", 80000), ("R3", "KR3", "R3F", 50000)):
    B.update({"%s:cari:%s:bakiye" % (K, c): 100000, "%s:kart:%s:odenen" % (K, kart): 0, "%s:kart:%s:kalan" % (K, kart): 40000,
              "%s:kart:%s:taksit1:odenen" % (K, kart): 0, "%s:kart:%s:taksit2:odenen" % (K, kart): 0, "%s:fatura:%s:acik" % (K, f): 60000, "%s:cari:%s:gecikmis" % (K, c): gec})
    Y += ["%s:takvim:hareket:%sx" % (K, c.lower()), "%s:takvim:fatura:%s" % (K, f), "%s:takvim:cariToplam:%s" % (K, c)]
# R3: şüpheli 500 → t1 0, F 300, t2 200 → gecikmiş 500
# R4: taksitli fatura + elle Borç: R 300 → F#1 0, F#2 100, Borç 300 (vade 20.06 — gecikmemiş) → gecikmiş 100; Borç kalemi 300 kendi vadesinde
B.update({K + ":cari:R4:bakiye": 70000, K + ":fatura:R4F:acik": 40000, K + ":hareket:r4x:kalan": 30000,
          K + ":takvim:hareket:r4x": tk(30000, "2026-06-20", 5, "R4", isim["R4"]), K + ":vadeTakip:hareket:r4x": vt(30000, "2026-06-20"),
          K + ":projeksiyon:hareket:r4x": vt(30000, "2026-06-20"), K + ":cari:R4:gecikmis": 10000})
# R5: verilen avans: Borç 200 (01.06) + Ödeme 300 (02.06) → şüpheli 400 → Borç 0, avans 100 → gecikmiş 100; görünüm toplamı 100 = 500 − 400
B.update({K + ":cari:R5:bakiye": 50000, K + ":hareket:r5x:kalan": 20000, K + ":takvim:hareket:r5x": "yok", K + ":vadeTakip:hareket:r5x": "yok", K + ":projeksiyon:hareket:r5x": "yok",
          K + ":takvim:hareket:r5o": tk(10000, "2026-06-02", -13, "R5", isim["R5"]), K + ":vadeTakip:hareket:r5o": vt(10000, "2026-06-02"),
          K + ":projeksiyon:hareket:r5o": vt(10000, "2026-06-02"), K + ":cari:R5:gecikmis": 10000,
          K + ":takvim:cariToplam:R5": 10000, K + ":vadeTakip:cariToplam:R5": 10000, K + ":projeksiyon:cariToplam:R5": 10000})
# R7 (SK-30): şüpheliden sonra Taksit Tahsilatı 200 — S130 görünümü / gecikmiş SUS; kart göstergeleri ve bakiye yazılır
B.update({K + ":cari:R7:bakiye": 80000, K + ":kart:KR7:odenen": 20000, K + ":kart:KR7:kalan": 20000, K + ":kart:KR7:taksit1:odenen": 20000, K + ":kart:KR7:taksit2:odenen": 0,
          K + ":fatura:R7F:acik": 60000})
Y += [K + ":cari:R7:gecikmis"]
BL += [["cari R7 S130 görünümü tanımsız", "SK-30", "KULLANICIYA SORULMALI"]]
# V1 (S139): şüpheli 300 gecikmiş Borç 300'ü bitirir; Borç 400 (vade 30.06) gecikmemiş → gecikmiş 0 (B: 300)
B.update({K + ":cari:V1:bakiye": 70000, K + ":cari:V1:gecikmis": 0, K + ":hareket:v1x:kalan": 30000, K + ":takvim:hareket:v1x": "yok", K + ":vadeTakip:hareket:v1x": "yok",
          K + ":projeksiyon:hareket:v1x": "yok", K + ":hareket:v1y:kalan": 40000, K + ":takvim:hareket:v1y": "yok", K + ":projeksiyon:hareket:v1y": vt(40000, "2026-06-30"),
          K + ":takvim:cariToplam:V1": 0, K + ":projeksiyon:cariToplam:V1": 40000})
# S145
B.update({"adim:s1t:durum": "ret", K + ":cari:S1:bakiye": 100000, K + ":hareket:s1x:kalan": 100000, K + ":takvim:hareket:s1x": tk(10000, "2026-04-01", -75, "S1", isim["S1"]),
          K + ":vadeTakip:hareket:s1x": vt(10000, "2026-04-01"), K + ":projeksiyon:hareket:s1x": vt(10000, "2026-04-01"), K + ":cari:S1:gecikmis": 10000,
          K + ":takvim:cariToplam:S1": 10000, K + ":vadeTakip:cariToplam:S1": 10000, K + ":projeksiyon:cariToplam:S1": 10000})
for c, ad, kal, gor in (("S2", "s2t", 70000, 10000), ("S3", "s3t", 70000, 10000), ("S4", "s4t", 70000, 20000), ("S5", "s5t", 70000, 0)):
    x = c.lower() + "x"
    B.update({"adim:%s:durum" % ad: "ok", "%s:cari:%s:bakiye" % (K, c): 70000, "%s:hareket:%s:kalan" % (K, x): kal, "%s:cari:%s:gecikmis" % (K, c): gor,
              "%s:takvim:cariToplam:%s" % (K, c): gor, "%s:projeksiyon:cariToplam:%s" % (K, c): gor})
    if gor:
        B.update({"%s:takvim:hareket:%s" % (K, x): tk(gor, "2026-04-01", -75, c, isim[c]), "%s:vadeTakip:hareket:%s" % (K, x): vt(gor, "2026-04-01"),
                  "%s:projeksiyon:hareket:%s" % (K, x): vt(gor, "2026-04-01")})
    else:
        B.update({"%s:takvim:hareket:%s" % (K, x): "yok", "%s:vadeTakip:hareket:%s" % (K, x): "yok", "%s:projeksiyon:hareket:%s" % (K, x): "yok"})
B.update({"adim:s6k:durum": "ret", K + ":cari:S6:bakiye": 40000, K + ":kart:KS6:odenen": 0, K + ":kart:KS6:kalan": 40000, K + ":kart:KS6:taksit1:odenen": 0,
          K + ":kart:KS6:taksit2:odenen": 0, K + ":cari:S6:gecikmis": 0})
Y += ["adim:s7e:durum", K + ":cari:S7:bakiye", K + ":hareket:s7x:kalan", K + ":cari:S7:gecikmis", "adim:s8t:durum", K + ":cari:S8:bakiye", "adim:s9t:durum", K + ":cari:S9:bakiye"]
BL += [["adım s7e", "S145", "SK-33"], ["adım s8t", "S145", "SK-34 (a)"], ["adım s9t", "S145", "SK-34 (b)"]]
# W1 (S148): vade 05.06 (geçti), söz 30.06 → projeksiyon kalemi söz gününde (bir kez), takvim kalemi ufuk dışında, gecikmiş 100 (S52)
B.update({K + ":cari:W1:bakiye": 10000, K + ":hareket:w1x:kalan": 10000, K + ":takvim:hareket:w1x": "yok", K + ":projeksiyon:hareket:w1x": vt(10000, "2026-06-30"),
          K + ":cari:W1:gecikmis": 10000, K + ":takvim:cariToplam:W1": 0, K + ":projeksiyon:cariToplam:W1": 10000})
yaz("d41-c5-s136-s139-s145-s148", "Bakım 15: S136 A — şüpheliye alınan tutar taksit kalemlerinden (R2 tek taksiti bitirir, R3 aşıp faturaya geçer), taksitli faturanın taksitlerinden (R4) ve "
    "verilen avans kaleminden (R5) de kuyruk sırasıyla düşer (kararın örneği d40 Q3); SK-30 (R7 — şüpheliden sonra Taksit Tahsilatı) SUS; S139 A — gecikmiş görünen kalemlerden (V1; kararın "
    "örneği d39 N1); S145 A — şüpheli tarihinden önceye tahsilat o tarihte borcu aşırıyorsa RET (S1 kararın örneği, S6 Taksit Tahsilatı), bugün (S2) / aynı gün (S3) / borç yetiyor (S4) / tam "
    "eşitlik (S5) kabul; SK-33 (S7 çek) ve SK-34 (a) / (b) (S8 / S9) SUS; S148 A onay (W1)",
    "KARARLAR.md §26 (Y15-1 … Y15-6, Y15-9), §25 (Y14-2 … Y14-5), §8 (K6.3, ŞÜPHELİ KALAN K1), §13 C13.4 / C13.5, §16 C16.1 / C16.4, §17 (S96)", A, B, Y, BL)

# ───────────────────────── d42: S140 A + S151 B (satışla açılan kart iadeyle küçülür)
A, B, Y, BL = [], {}, [], []
isim = {"T1": "Tarık Örnek İade", "T2": "Tamer Tahsil Edilen", "T3": "Tansu Tam İade", "T4": "Taner Fazla İade", "T5": "Tayfun İki Satış", "T6": "Tekin Tahsilatlı İade",
        "T7": "Tevfik Elle Kart İade", "T8": "Turan İade Geri Ödeme"}
for c in ("T1", "T2", "T3", "T4", "T5", "T6", "T8"):
    A.append({"id": "c" + c.lower(), "islem": "cari_ac", "ad": c, "isim": isim[c], "tarih": "2026-05-01"})
A.append({"id": "ct7", "islem": "cari_ac", "ad": "T7", "isim": isim["T7"], "tarih": "2026-03-01"})
A += [{"id": "t7x", "islem": "borc", "cari": "T7", "tutar": "900", "tarih": "2026-03-01"},
      {"id": "kt7", "islem": "kart_ac", "ad": "KT7", "cari": "T7", "tutar": "900", "taksit": 3, "ilkVade": "2026-04-01", "tarih": "2026-03-15", "mevcut": True},
      {"id": "t7i", "islem": "stok_iade", "cari": "T7", "tutar": "300", "tarih": "2026-04-10"},
      {"id": "t5f", "islem": "fatura", "ad": "T5F", "cari": "T5", "tutar": "600", "tarih": "2026-05-01"}]
for c, iade in (("T1", "800"), ("T2", "300"), ("T3", "1000"), ("T4", "1200")):
    A.append({"id": c.lower() + "b", "islem": "borc", "cari": c, "tutar": "500", "tarih": "2026-05-01", "vade": "2026-06-20"})
for c in ("T1", "T2", "T3", "T4", "T5", "T6", "T8"):
    A.append({"id": c.lower() + "s", "islem": "stok_satis_taksit", "ad": "K" + c, "cari": c, "tutar": "1000", "tarih": "2026-05-01", "taksit": 2, "ilkVade": "2026-06-01"})
A += [{"id": "t6k", "islem": "kart_tahsilat", "kayit": "KT6", "tutar": "300", "tarih": "2026-06-05"}]
for c, iade in (("T1", "800"), ("T2", "300"), ("T3", "1000"), ("T4", "1200"), ("T5", "400"), ("T6", "400"), ("T8", "300")):
    A.append({"id": c.lower() + "i", "islem": "stok_iade", "cari": c, "tutar": iade, "tarih": "2026-06-10"})
A += [{"id": "t8o", "islem": "odeme", "cari": "T8", "tutar": "300", "tarih": "2026-06-12"}]
# T1 kararın örneği: Borç 500 (vade 20.06) + satış 1.000 (taksit 01.06 geçmiş + 01.07 ileride) → iade 800 ⇒ taksit kalanları 0 / 200, gecikmiş 0, Borç 500 kendi vadesinde; bakiye 700
for c, bak, kalan, gec in (("T1", 70000, 20000, 0), ("T2", 120000, 70000, 20000), ("T3", 50000, 0, 0)):
    kt = "K" + c
    B.update({"%s:cari:%s:bakiye" % (K, c): bak, "%s:kart:%s:var" % (K, kt): True, "%s:kart:%s:toplam" % (K, kt): 100000, "%s:kart:%s:odenen" % (K, kt): 0,
              "%s:kart:%s:kalan" % (K, kt): kalan, "%s:kart:%s:taksit1:odenen" % (K, kt): 0, "%s:kart:%s:taksit2:odenen" % (K, kt): 0,
              "%s:hareket:%sb:kalan" % (K, c.lower()): 50000, "%s:takvim:hareket:%sb" % (K, c.lower()): tk(50000, "2026-06-20", 5, c, isim[c]),
              "%s:vadeTakip:hareket:%sb" % (K, c.lower()): vt(50000, "2026-06-20"), "%s:projeksiyon:hareket:%sb" % (K, c.lower()): vt(50000, "2026-06-20"),
              "%s:cari:%s:gecikmis" % (K, c): gec})
# T4 (SK-31 (a)): iade 1.200 > kartın açığı 1.000 — cari tanımsız (bakiye, kart tutarı yazılır)
B.update({K + ":cari:T4:bakiye": 30000, K + ":kart:KT4:var": True, K + ":kart:KT4:toplam": 100000})
Y += [K + ":kart:KT4:odenen", K + ":kart:KT4:kalan", K + ":kart:KT4:taksit1:odenen", K + ":hareket:t4b:kalan", K + ":takvim:hareket:t4b", K + ":cari:T4:gecikmis"]
BL += [["cari T4 tanımsız", "S140", "SK-31 (a)"]]
# T5 (SK-31 (b)): satış faturası + satış kartı → iade hangi satışın
B.update({K + ":cari:T5:bakiye": 120000, K + ":kart:KT5:var": True, K + ":kart:KT5:toplam": 100000})
Y += [K + ":kart:KT5:odenen", K + ":kart:KT5:kalan", K + ":fatura:T5F:acik", K + ":cari:T5:gecikmis"]
BL += [["cari T5 tanımsız", "S140", "SK-31 (b)"]]
# T6: kart tahsilatı 300 (05.06, bağ: 1. taksitten) + iade 400 (10.06 → 1. taksitin kalanı 200 + 2. taksitten 200) ⇒ Tahsil Edilen 300, Kalan 300, taksit Ödenen 300 / 0; bakiye 300
B.update({K + ":cari:T6:bakiye": 30000, K + ":kart:KT6:odenen": 30000, K + ":kart:KT6:kalan": 30000, K + ":kart:KT6:taksit1:odenen": 30000, K + ":kart:KT6:taksit2:odenen": 0,
          K + ":cari:T6:gecikmis": 0})
# T7 (SK-32): Taksitler'den Mevcut Borç kartı + faturasız stok iadesi → 'Tahsil Edilen' / taksit 'Ödenen' yazılmaz, Kalan 600
B.update({K + ":cari:T7:bakiye": 60000, K + ":kart:KT7:toplam": 90000, K + ":kart:KT7:kalan": 60000})
Y += [K + ":kart:KT7:odenen", K + ":kart:KT7:taksit1:odenen", K + ":kart:KT7:taksit2:odenen", K + ":kart:KT7:taksit3:odenen"]
BL += [["kart KT7", "SK-32"]]
# T8 (SK-31 (c)): iadenin geri ödemesi
B.update({K + ":cari:T8:bakiye": 100000, K + ":kart:KT8:var": True, K + ":kart:KT8:toplam": 100000})
Y += [K + ":kart:KT8:odenen", K + ":kart:KT8:kalan"]
BL += [["cari T8 tanımsız", "S140", "SK-31 (c)"]]
yaz("d42-c5-s140-s151-satis-karti-iade", "Bakım 15: S140 A — satışla açılan kart iadeyle küçülünce kendi satışını taşır (T1 kararın örneği; T3 iade satışın tamamı; T6 kart tahsilatından sonra iade); "
    "S151 B — satış kartının 'Tahsil Edilen'i / taksit 'Ödenen'i faturasız stok iadesini saymaz (T2 kararın örneği; T1 / T3 / T6); SUS: SK-31 (a) iade kartın açığından büyük (T4), (b) başka "
    "satış (T5), (c) iadenin geri ödemesi (T8); SK-32 satış kartı olmayan kartta iade (T7)",
    "KARARLAR.md §26 (Y15-5, Y15-7), §20 (S110 — Y8-2), §19 (Y7-2), §13 C13.4 / C13.5, §25 Y14-10 (S129)", A, B, Y, BL)

# ───────────────────────── d43: BİLİNEN SINIRLAR DEĞER'den SUS'a — S144 (c) (U1), S141 + S144 (U2), S143 (a) (U3), S149 (U4, U6) ve komşuları (U5 söz günü, U7 C15.1)
A, B, Y, BL = [], {}, [], []
isim = {"U1": "Umut Fazla Taksit", "U2": "Uğur Kart Fazlası Fatura", "U3": "Ufuk Alacak Yazılı Kart", "U4": "Ümit Söz Geçti", "U5": "Ülkü Söz Bugün", "U6": "Ünal Vade Bugün",
        "U7": "Ünsal Vade Geçti Söz Geçti"}
A += [{"id": "cu1", "islem": "cari_ac", "ad": "U1", "isim": isim["U1"], "tarih": "2026-03-01"},
      {"id": "u1x", "islem": "borc", "cari": "U1", "tutar": "1000", "tarih": "2026-03-01"},
      {"id": "ku1", "islem": "kart_ac", "ad": "KU1", "cari": "U1", "tutar": "1000", "taksit": 2, "ilkVade": "2026-04-01", "tarih": "2026-03-15", "mevcut": True},
      {"id": "u1k", "islem": "kart_tahsilat", "kayit": "KU1", "tutar": "1100", "tarih": "2026-04-10"}]
for c in ("U2", "U3"):
    A.append({"id": "c" + c.lower(), "islem": "cari_ac", "ad": c, "isim": isim[c], "tarih": "2026-05-01"})
A += [{"id": "u2f", "islem": "fatura", "ad": "U2F", "cari": "U2", "tutar": "600", "tarih": "2026-05-01"},
      {"id": "u2x", "islem": "borc", "cari": "U2", "tutar": "400", "tarih": "2026-05-02"},
      {"id": "ku2", "islem": "kart_ac", "ad": "KU2", "cari": "U2", "tutar": "400", "taksit": 2, "ilkVade": "2026-06-01", "tarih": "2026-05-05", "mevcut": True},
      {"id": "u3x", "islem": "borc", "cari": "U3", "tutar": "900", "tarih": "2026-05-01"},
      {"id": "ku3", "islem": "kart_ac", "ad": "KU3", "cari": "U3", "tutar": "900", "taksit": 3, "ilkVade": "2026-06-01", "tarih": "2026-05-05", "mevcut": True}]
for c in ("U4", "U5", "U6", "U7"):
    A.append({"id": "c" + c.lower(), "islem": "cari_ac", "ad": c, "isim": isim[c], "tarih": "2026-06-01"})
A += [{"id": "u4x", "islem": "borc", "cari": "U4", "tutar": "150", "tarih": "2026-06-01", "vade": "2026-06-25", "beklenen": "2026-06-10"},
      {"id": "u5x", "islem": "borc", "cari": "U5", "tutar": "150", "tarih": "2026-06-01", "vade": "2026-06-25", "beklenen": "2026-06-15"},
      {"id": "u6x", "islem": "borc", "cari": "U6", "tutar": "150", "tarih": "2026-06-01", "vade": "2026-06-15", "beklenen": "2026-06-10"},
      {"id": "u7x", "islem": "borc", "cari": "U7", "tutar": "150", "tarih": "2026-06-01", "vade": "2026-06-05", "beklenen": "2026-06-10"},
      {"id": "u2k", "islem": "kart_tahsilat", "kayit": "KU2", "tutar": "600", "tarih": "2026-06-10"},
      {"id": "u3a", "islem": "alacak", "cari": "U3", "tutar": "200", "tarih": "2026-06-10"}]
# U1 (S144 (c)): kart 1.000 (2 × 500), kart tahsilatı 1.100 → 'Tahsil Edilen' yazılmaz; Kalan 0, taksit Ödenen 500 / 500; bakiye −100
B.update({K + ":cari:U1:bakiye": -10000, K + ":kart:KU1:kalan": 0, K + ":kart:KU1:taksit1:odenen": 50000, K + ":kart:KU1:taksit2:odenen": 50000})
Y += [K + ":kart:KU1:odenen"]
BL += [["kart KU1", "S144 = C", "BİLİNEN SINIR"]]
# U2 (S141 + S144 (c)): F 600 + Borç 400 → kart 400 (Borç'u taşır — S110) → kart tahsilatı 600 (fazlası 200 kuyrukta F'yi kapatır) ⇒ F belge açığı / açık toplamı yazılmaz; takvimde F 400
B.update({K + ":cari:U2:bakiye": 40000, K + ":kart:KU2:kalan": 0, K + ":kart:KU2:taksit1:odenen": 20000, K + ":kart:KU2:taksit2:odenen": 20000,
          K + ":takvim:fatura:U2F": {"amount": 40000, "direction": "in"}})
Y += [K + ":fatura:U2F:acik", K + ":cari:U2:acikToplam", K + ":kart:KU2:odenen"]
BL += [["cari U2 satış faturalarının belge açığı tanımsız", "S141 = C", "BİLİNEN SINIR"], ["kart KU2", "S144 = C"]]
# U3 (S143 (a)): Borç 900 → kart 900 (3 × 300) → Alacak Yaz 200 ⇒ kartın Kalan'ı yazılmaz; Tahsil Edilen 0, taksit Ödenen 0; bakiye 700
B.update({K + ":cari:U3:bakiye": 70000, K + ":kart:KU3:odenen": 0, K + ":kart:KU3:taksit1:odenen": 0, K + ":kart:KU3:taksit2:odenen": 0, K + ":kart:KU3:taksit3:odenen": 0})
Y += [K + ":kart:KU3:kalan"]
BL += [["kart KU3", "S143 = C", "BİLİNEN SINIR"]]
# U4 (S149): borç 150, vade 25.06, söz 10.06 (geçti) ⇒ takvim kalemi ve gecikmiş yazılmaz; Vade Takip / projeksiyon kalemi söz gününde
B.update({K + ":cari:U4:bakiye": 15000, K + ":hareket:u4x:kalan": 15000, K + ":vadeTakip:hareket:u4x": vt(15000, "2026-06-10"), K + ":projeksiyon:hareket:u4x": vt(15000, "2026-06-10")})
Y += [K + ":takvim:hareket:u4x", K + ":cari:U4:gecikmis"]
BL += [["takvim kalemi u4x", "S149 = C", "BİLİNEN SINIR"], ["cari U4 gecikmiş tutarı tanımsız", "S149 = C"]]
# U5: söz günü (Beklenen = bugün) — K6.3 aynen: 'today' 0; gecikmiş 0 (ayrışma yok)
B.update({K + ":cari:U5:bakiye": 15000, K + ":takvim:hareket:u5x": tk(15000, "2026-06-15", 0, "U5", isim["U5"], soz=True), K + ":cari:U5:gecikmis": 0})
# U6: vade günü bugün, söz geçti → S149 alanı (vade ≥ bugün) — SUS
B.update({K + ":cari:U6:bakiye": 15000, K + ":vadeTakip:hareket:u6x": vt(15000, "2026-06-10")})
Y += [K + ":takvim:hareket:u6x", K + ":cari:U6:gecikmis"]
BL += [["takvim kalemi u6x", "S149 = C"]]
# U7: vade geçti (05.06), söz geçti (10.06) — S149 alanı dışında: C15.1 'Gecikmiş', gün sayısı vadeden (−10); gecikmiş 150
B.update({K + ":cari:U7:bakiye": 15000, K + ":takvim:hareket:u7x": tk(15000, "2026-06-10", -10, "U7", isim["U7"], soz=True), K + ":cari:U7:gecikmis": 15000})
yaz("d43-c5-bilinen-sinir-sus15", "Bakım 15: BİLİNEN SINIRLAR (kullanıcı kararları C) — kâhinin bugün DEĞER verdiği ayrışan alanlar SUS'a çevrildi: S144 (c) kartın kendi fazla tahsilatı (U1), S141 kart "
    "fazlası + fatura belge açığı (U2), S143 (a) Alacak Yaz ile netleşen kartın Kalan'ı (U3), S149 vadesi gelmemiş / sözü geçmiş borç (U4; U6 vade günü); komşular değerle: U5 söz günü (K6.3), U7 "
    "vade de söz de geçmiş (C15.1)",
    "KARARLAR.md §26 (Y15-12 … Y15-16), §13 C13.4 (3) / C13.5, §15 C15.1 / C15.2, §16 C16.2, §20 Y8-4", A, B, Y, BL)
print("yazıldı: d41, d42, d43")
