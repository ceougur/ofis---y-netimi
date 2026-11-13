#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kâhin bakımı 17 (cari; S159 A, kart tahsilatı 'Fazlasını Avans Yaz' seçeneği (S118 B sınırı, S154 B), S162 = B / S163 = C susması): yeni elle senaryo d45 + d30 / d42 / d43 / d44'ün
karar gereği güncellenmesi. Elle değerler KARAR METNİNDEN ve KARARLAR.md §28 Y17-1 … Y17-6'dan elle hesaplandı (kâhin koşulmadan — ders 40); tutarlar kuruş. Program AÇILMAZ.

  python3 -I senaryolar17.py <test/bagimsiz/cari/senaryolar>      (bir kez koşar — eski hâli assert'le denetler)
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
G60, G40, G30 = "2026-04-16", "2026-05-06", "2026-05-16"  # bugün 15.06: 60 / 40 / 30 gün önce (d44 ile aynı günler)

A, B, Y, BL = [], {}, [], []
isim = {"Z2": "Zehra Tam Tahsilat", "Z3": "Zafer Kısmi Tahsilat", "Z4": "Zeki Önceye Aşan Ret", "Z5": "Zerrin Çekle Aşan",
        "A1": "Ahu Avans Yaz Örnek", "A2": "Ayla Yanıtsız Ret", "A3": "Aras Aşmayan Seçenekli", "A4": "Ali Tam Kalan", "A5": "Asım Bağsız Payı Sınır",
        "A6": "Arda İade Sınır Yanıtsız", "A6B": "Arda İade Sınır Seçenekli",
        "B1": "Bora Örnek İade Tek Borç", "B2": "Berk Sonra Borç Karşılaştırma",
        "C1": "Cem Kapanmış Eski Borç", "C2": "Can Kapanmış Borç Yok", "C3": "Ceyda Kapanmış Hepsi Gecikmiş"}
for c in ("Z2", "Z3", "Z4", "Z5"):
    A.append({"id": "c" + c.lower(), "islem": "cari_ac", "ad": c, "isim": isim[c], "tarih": G60})
for c in ("A1", "A2", "A3", "A4", "A5", "A6", "A6B"):
    A.append({"id": "c" + c.lower(), "islem": "cari_ac", "ad": c, "isim": isim[c], "tarih": "2026-03-01"})
for c in ("B1", "B2"):
    A.append({"id": "c" + c.lower(), "islem": "cari_ac", "ad": c, "isim": isim[c], "tarih": "2026-04-01"})
for c in ("C1", "C2", "C3"):
    A.append({"id": "c" + c.lower(), "islem": "cari_ac", "ad": c, "isim": isim[c], "tarih": "2026-01-01"})

# ── S159 (kararın örneği d44 X12'de; burada kararın komşuları): borç 1.000 (60 gün önce) → şüpheli 900 (30 gün önce) → tahsilat
for c, tutar, tarih in (("Z2", "1000", BUGUN), ("Z3", "300", BUGUN), ("Z4", "1100", G40)):
    A += [{"id": c.lower() + "a", "islem": "borc", "cari": c, "tutar": "1000", "tarih": G60},
          {"id": c.lower() + "s", "islem": "supheli_al", "ad": "S" + c, "cari": c, "tutar": "900", "tarih": G30},
          {"id": c.lower() + "t", "islem": "tahsilat", "cari": c, "tutar": tutar, "tarih": tarih}]
# Z5: aynı örnek, tahsilat yerine bugün tarihli alınan çek 1.100 (türü fark etmez — S155; açık şüpheli kalmadı — S159)
A += [{"id": "z5a", "islem": "borc", "cari": "Z5", "tutar": "1000", "tarih": G60},
      {"id": "z5s", "islem": "supheli_al", "ad": "SZ5", "cari": "Z5", "tutar": "900", "tarih": G30},
      {"id": "z5e", "islem": "evrak", "ad": "EZ5", "cari": "Z5", "tur": "cek", "tutar": "1100", "tarih": BUGUN}]
B.update({"adim:z2t:durum": "ok", "k1:cari:Z2:bakiye": 0, "k1:cari:Z2:gecikmis": 0, "k1:takvim:cariToplam:Z2": 0,
          "adim:z3t:durum": "ok", "k1:cari:Z3:bakiye": 70000, "k1:cari:Z3:gecikmis": 10000, "k1:takvim:cariToplam:Z3": 10000,
          "adim:z4t:durum": "ret", "k1:cari:Z4:bakiye": 100000, "k1:cari:Z4:gecikmis": 10000, "k1:takvim:cariToplam:Z4": 10000,
          "adim:z5e:durum": "ok", "k1:cari:Z5:bakiye": -10000})

# ── Kart tahsilatı seçeneği (S118 B sınırı) ve S154 B: borç 1.200 (01.03) → kart 1.200 / 3 (15.03; taksitler 01.04, 01.05, 01.06 — 400 × 3)
for c in ("A1", "A2", "A3", "A4"):
    A += [{"id": c.lower() + "x", "islem": "borc", "cari": c, "tutar": "1200", "tarih": "2026-03-01"},
          {"id": "k" + c.lower(), "islem": "kart_ac", "ad": "K" + c, "cari": c, "tutar": "1200", "taksit": 3, "ilkVade": "2026-04-01", "tarih": "2026-03-15", "mevcut": True}]
A += [
    # A1: S154'ün örneği AYNEN — karttan 500 (K 1.200 — soru yok), sonra karttan 800 'Fazlasını Avans Yaz' (K 700 < 800)
    {"id": "ka1a", "islem": "kart_tahsilat", "kayit": "KA1", "tutar": "500", "tarih": "2026-04-10"},
    {"id": "ka1b", "islem": "kart_tahsilat", "kayit": "KA1", "tutar": "800", "tarih": "2026-05-10", "fazlasiniAvansYaz": True},
    # A2: aynı adım seçeneksiz (yanıt yok / vazgeçildi) — RET
    {"id": "ka2a", "islem": "kart_tahsilat", "kayit": "KA2", "tutar": "500", "tarih": "2026-04-10"},
    {"id": "ka2b", "islem": "kart_tahsilat", "kayit": "KA2", "tutar": "800", "tarih": "2026-05-10"},
    # A3: kalanı AŞMAYAN tahsilatta seçenek etkisiz (A2'nin ilk adımıyla aynı sonuç)
    {"id": "ka3a", "islem": "kart_tahsilat", "kayit": "KA3", "tutar": "500", "tarih": "2026-04-10", "fazlasiniAvansYaz": True},
    # A4: kalan TAM (700 = K) seçeneksiz — kabul
    {"id": "ka4a", "islem": "kart_tahsilat", "kayit": "KA4", "tutar": "500", "tarih": "2026-04-10"},
    {"id": "ka4b", "islem": "kart_tahsilat", "kayit": "KA4", "tutar": "700", "tarih": "2026-05-10"},
    # A5: S129'un örneği + sınır kartın KENDİ kalanı: borç 900 → kart 900 / 3 → karta BAĞLANMADAN 500 → karttan 600 seçeneksiz (K 900 — kabul; tek kuyruk Kalan'ı 400 olurdu — mutant 307)
    {"id": "a5x", "islem": "borc", "cari": "A5", "tutar": "900", "tarih": "2026-03-01"},
    {"id": "ka5", "islem": "kart_ac", "ad": "KA5", "cari": "A5", "tutar": "900", "taksit": 3, "ilkVade": "2026-04-01", "tarih": "2026-03-15", "mevcut": True},
    {"id": "a5t", "islem": "tahsilat", "cari": "A5", "tutar": "500", "tarih": "2026-04-10"},
    {"id": "ka5a", "islem": "kart_tahsilat", "kayit": "KA5", "tutar": "600", "tarih": "2026-05-10"},
]
# A6 / A6B: SK-36 (b) — Borç 900 + Borç Z 500 (vade 30.06) → kart 900 / 3 (tek eşit elle borcu taşır) → faturasız stok iadesi 300 (kartın 1. taksitini kapatır) → karttan 700
for c, sec in (("A6", None), ("A6B", True)):
    lc = c.lower()
    A += [{"id": lc + "x", "islem": "borc", "cari": c, "tutar": "900", "tarih": "2026-03-01"},
          {"id": lc + "z", "islem": "borc", "cari": c, "tutar": "500", "tarih": "2026-03-01", "vade": "2026-06-30"},
          {"id": "k" + lc, "islem": "kart_ac", "ad": "K" + c, "cari": c, "tutar": "900", "taksit": 3, "ilkVade": "2026-04-01", "tarih": "2026-03-15", "mevcut": True},
          {"id": lc + "i", "islem": "stok_iade", "cari": c, "tutar": "300", "tarih": "2026-04-10"},
          dict({"id": "k" + lc + "t", "islem": "kart_tahsilat", "kayit": "K" + c, "tutar": "700", "tarih": "2026-05-10"}, **({"fazlasiniAvansYaz": True} if sec else {}))]
B.update({
    "adim:ka1a:durum": "ok", "adim:ka1b:durum": "ok", "k1:cari:A1:bakiye": -10000, "k1:cari:A1:gecikmis": 0, "k1:kart:KA1:toplam": 120000,
    "k1:kart:KA1:odenen": 130000, "k1:kart:KA1:kalan": 0, "k1:kart:KA1:taksit1:odenen": 40000, "k1:kart:KA1:taksit2:odenen": 40000, "k1:kart:KA1:taksit3:odenen": 40000,
    "adim:ka2a:durum": "ok", "adim:ka2b:durum": "ret", "k1:cari:A2:bakiye": 70000, "k1:cari:A2:gecikmis": 70000,
    "k1:kart:KA2:odenen": 50000, "k1:kart:KA2:kalan": 70000, "k1:kart:KA2:taksit1:odenen": 40000, "k1:kart:KA2:taksit2:odenen": 10000, "k1:kart:KA2:taksit3:odenen": 0,
    "adim:ka3a:durum": "ok", "k1:cari:A3:bakiye": 70000,
    "k1:kart:KA3:odenen": 50000, "k1:kart:KA3:kalan": 70000, "k1:kart:KA3:taksit1:odenen": 40000, "k1:kart:KA3:taksit2:odenen": 10000, "k1:kart:KA3:taksit3:odenen": 0,
    "adim:ka4a:durum": "ok", "adim:ka4b:durum": "ok", "k1:cari:A4:bakiye": 0, "k1:cari:A4:gecikmis": 0,
    "k1:kart:KA4:odenen": 120000, "k1:kart:KA4:kalan": 0, "k1:kart:KA4:taksit1:odenen": 40000, "k1:kart:KA4:taksit2:odenen": 40000, "k1:kart:KA4:taksit3:odenen": 40000,
    "adim:ka5a:durum": "ok", "k1:cari:A5:bakiye": -20000, "k1:cari:A5:gecikmis": 0,
    "k1:kart:KA5:odenen": 90000, "k1:kart:KA5:kalan": 0, "k1:kart:KA5:taksit1:odenen": 30000, "k1:kart:KA5:taksit2:odenen": 30000, "k1:kart:KA5:taksit3:odenen": 30000,
    "adim:ka6bt:durum": "ok", "k1:cari:A6B:bakiye": 40000, "k1:cari:A6B:gecikmis": 0,
    "k1:kart:KA6B:odenen": 70000, "k1:kart:KA6B:kalan": 0, "k1:kart:KA6B:taksit1:odenen": 30000, "k1:kart:KA6B:taksit2:odenen": 30000, "k1:kart:KA6B:taksit3:odenen": 10000,
    "k1:hareket:a6bz:kalan": 40000,
})
Y += ["adim:ka6t:durum", "k1:cari:A6:bakiye"]
BL.append(["adım ka6t", "SK-36", "KULLANICIYA SORULMALI"])

# ── S162 = B: B1 kararın örneği (Borç 900 → kart 900 = 3 × 300; vadeler 06.05 (40 gün önce), 06.06, 06.07 → faturasız stok iadesi 300); B2 karşılaştırma (sonradan borç 500, vade 30.06)
for c in ("B1", "B2"):
    lc = c.lower()
    A += [{"id": lc + "x", "islem": "borc", "cari": c, "tutar": "900", "tarih": "2026-04-15"},
          {"id": "k" + lc, "islem": "kart_ac", "ad": "K" + c, "cari": c, "tutar": "900", "taksit": 3, "ilkVade": "2026-05-06", "tarih": "2026-04-20", "mevcut": True},
          {"id": lc + "i", "islem": "stok_iade", "cari": c, "tutar": "300", "tarih": "2026-06-10"}]
A.append({"id": "b2y", "islem": "borc", "cari": "B2", "tutar": "500", "tarih": "2026-06-12", "vade": "2026-06-30"})
B.update({"k1:cari:B1:bakiye": 60000, "k1:kart:KB1:kalan": 60000, "k1:kart:KB1:odenen": 0,
          "k1:cari:B2:bakiye": 110000, "k1:kart:KB2:toplam": 90000, "k1:kart:KB2:kalan": 60000, "k1:kart:KB2:odenen": 0,
          "k1:kart:KB2:taksit1:odenen": 0, "k1:kart:KB2:taksit2:odenen": 0, "k1:kart:KB2:taksit3:odenen": 0, "k1:cari:B2:gecikmis": 30000})
Y += ["k1:kart:KB1:toplam", "k1:kart:KB1:taksit1:odenen", "k1:kart:KB1:taksit2:odenen", "k1:kart:KB1:taksit3:odenen", "k1:cari:B1:gecikmis"]
BL.append(["kart KB1", "S162 = B"])

# ── S163 = C: elle Borç E0 300 (01.01) → tahsilat 300 (05.01; E0 kapandı) → elle Borç E1 500 (01.02) + fatura F 600 (05.02) + elle Borç E2 400 (10.02) → ELLE kart 700 (15.02; O 1.500 > 700,
# karta eşit elle borç yok → S120: E1 500 + E2'nin 200'ü). C1 taksitler 01.07 / 01.08 (ileride); C2 aynı, E0 YOK (komşu — değerle); C3 = C1, taksitler 01.03 / 01.04 (hepsi gecikmiş)
for c, e0, ilk in (("C1", True, "2026-07-01"), ("C2", False, "2026-07-01"), ("C3", True, "2026-03-01")):
    lc = c.lower()
    if e0:
        A += [{"id": lc + "e0", "islem": "borc", "cari": c, "tutar": "300", "tarih": "2026-01-01"},
              {"id": lc + "t", "islem": "tahsilat", "cari": c, "tutar": "300", "tarih": "2026-01-05"}]
    A += [{"id": lc + "e1", "islem": "borc", "cari": c, "tutar": "500", "tarih": "2026-02-01"},
          {"id": lc + "f", "islem": "fatura", "ad": c + "F", "cari": c, "tutar": "600", "tarih": "2026-02-05"},
          {"id": lc + "e2", "islem": "borc", "cari": c, "tutar": "400", "tarih": "2026-02-10"},
          {"id": "k" + lc, "islem": "kart_ac", "ad": "K" + c, "cari": c, "tutar": "700", "taksit": 2, "ilkVade": ilk, "tarih": "2026-02-15", "mevcut": True}]
B.update({"k1:cari:C1:bakiye": 150000,
          "k1:cari:C2:bakiye": 150000, "k1:fatura:C2F:acik": 60000, "k1:hareket:c2e1:kalan": 50000, "k1:hareket:c2e2:kalan": 40000, "k1:kart:KC2:toplam": 70000,
          "k1:kart:KC2:odenen": 0, "k1:kart:KC2:kalan": 70000, "k1:kart:KC2:taksit1:odenen": 0, "k1:kart:KC2:taksit2:odenen": 0, "k1:cari:C2:gecikmis": 80000,
          "k1:takvim:fatura:C2F": {"amount": 60000, "direction": "in"},
          "k1:cari:C3:bakiye": 150000, "k1:cari:C3:gecikmis": 150000})
Y += ["k1:fatura:C1F:acik", "k1:hareket:c1e1:kalan", "k1:hareket:c1e2:kalan", "k1:kart:KC1:odenen", "k1:kart:KC1:kalan", "k1:kart:KC1:taksit1:odenen", "k1:kart:KC1:taksit2:odenen",
      "k1:cari:C1:gecikmis", "k1:takvim:fatura:C1F",
      "k1:fatura:C3F:acik", "k1:hareket:c3e2:kalan", "k1:kart:KC3:kalan", "k1:kart:KC3:taksit1:odenen"]
BL += [["cari C1 açık kalem dağılımı", "S163 = C"], ["cari C3 açık kalem dağılımı", "S163 = C"]]

s = {"dil": "destekofis-cari/3", "ad": "d45-c5-s159-s154-s162-s163", "bugun": BUGUN,
     "aciklama": ("Bakım 17: S159 A — açık şüpheli kalmadıysa S155 bağlamaz (kararın örneği d44 X12; komşular: tam 1.000 Z2, 300 Z3, şüpheliden önceye aşan Z4 RET, çekle aşan Z5 kabul); "
                  "kart tahsilatı 'Fazlasını Avans Yaz' seçeneği — S154'ün örneği AYNEN (A1: Tahsil Edilen 1.300 · Kalan 0, bakiye −100), seçeneksiz RET (A2), kalanı aşmayanda etkisiz (A3), "
                  "tam kalan (A4), sınır kartın KENDİ kalanı — bağsız tahsilatın payı düşmez (A5, S129 örneği), SK-36 sınır bölgesi seçeneksiz SUS (A6) / seçenekli kabul (A6B); S162 = B "
                  "kararın örneği SUS (B1: kart toplamı, taksit Ödenen, gecikmiş; Kalan 600, Tahsil Edilen 0, bakiye 600 yazılır) + karşılaştırma örneği AYNEN (B2: gecikmiş 300); S163 = C S120 "
                  "kartı + kapanmış eski elle borç SUS (C1; C3 bütün kalemler gecikmiş — gecikmiş yazılır) + komşu C2 (kapanmış borç yok — değerle)"),
     "dayanak": "KARARLAR.md §28 (Y17-1 … Y17-6), §27 Y16-1 / Y16-2, §25 S129, §21 Y9-3 / Y9-7, §13 C13.4 (3) / (4)",
     "elleBeklenen": B, "elleYok": Y, "elleBelirsiz": BL, "adimlar": A + [KONTROL]}
bicim.yaz(os.path.join(D, "d45-c5-s159-s154-s162-s163.json"), s)


def oku(ad):
    p = os.path.join(D, ad + ".json")
    with open(p, encoding="utf-8") as f:
        return p, json.load(f)


# ── d43 (Y17-4 (1) / (2)): U1 / U2 kartın kendi kalanını aşan tahsilat — seçenekli; 'Tahsil Edilen' S154 B ile değer
p, s43 = oku("d43-c5-bilinen-sinir-sus15")
for a in s43["adimlar"]:
    if a["id"] in ("u1k", "u2k"):
        assert "fazlasiniAvansYaz" not in a
        a["fazlasiniAvansYaz"] = True
for k_ in ("k1:kart:KU1:odenen", "k1:kart:KU2:odenen"):
    assert k_ in s43["elleYok"], k_
s43["elleYok"] = [k_ for k_ in s43["elleYok"] if k_ not in ("k1:kart:KU1:odenen", "k1:kart:KU2:odenen")]
s43["elleBeklenen"].update({"k1:kart:KU1:odenen": 110000, "k1:kart:KU2:odenen": 60000})
eski = len(s43["elleBelirsiz"])
s43["elleBelirsiz"] = [x for x in s43["elleBelirsiz"] if x not in (["kart KU1", "S144 = C", "BİLİNEN SINIR"], ["kart KU2", "S144 = C"])]
assert len(s43["elleBelirsiz"]) == eski - 2
s43["aciklama"] += (" · bakım 17 (§28 Y17-4): U1 / U2'nin kart tahsilatı kartın KENDİ kalanını aşıyor — adım 'Fazlasını Avans Yaz' seçenekli (S118 B); 'Tahsil Edilen' S154 B ile karttan alınan"
                    " paranın tamamı (KU1 1.100, KU2 600); S141 (U2F) susması aynen")
bicim.yaz(p, s43)

# ── d30 (Y17-4 (3) / (4) / (5)): Q1 / Q3 / Q5 S101'in avansla 'Bitti' kartına tahsilat — seçenekli (iki okumada kabul); beklentiler AYNI
p, s30 = oku("d30-c5-s101-bitti-kart")
n = 0
for a in s30["adimlar"]:
    if a["id"] in ("q1k", "q3k", "q5k"):
        assert "fazlasiniAvansYaz" not in a
        a["fazlasiniAvansYaz"] = True
        n += 1
assert n == 3
s30["aciklama"] += (" · bakım 17 (§28 Y17-4): Q1 / Q3 / Q5'in Taksit Tahsilatı kartın kendi kalanının iki okumasının arasında (avansla ödenmiş kısım — SK-36) — S101 A ('kartın tahsilatı avansa"
                    " eklenir') gereği kabul: adım 'Fazlasını Avans Yaz' seçenekli; beklentiler değişmedi; KQ1 / KQ3 'Tahsil Edilen' S144 = C susması aynen")
bicim.yaz(p, s30)

# ── d42 (Y17-5): T7 S162 alanı (kart carinin bütün borcunu taşıyor + faturasız iade) — kart toplamı / taksit Ödenen SUS; T6 satış kartı aynı yapı — SK-37 SUS
p, s42 = oku("d42-c5-s140-s151-satis-karti-iade")
sus42 = ["k1:kart:KT7:toplam", "k1:kart:KT7:taksit1:odenen", "k1:kart:KT7:taksit2:odenen", "k1:kart:KT7:taksit3:odenen",
         "k1:kart:KT6:taksit1:odenen", "k1:kart:KT6:taksit2:odenen", "k1:cari:T6:gecikmis"]
for k_ in sus42:
    assert k_ in s42["elleBeklenen"], k_
    del s42["elleBeklenen"][k_]
s42["elleYok"] = list(s42["elleYok"]) + sus42 + ["k1:cari:T7:gecikmis", "k1:kart:KT6:toplam"]
s42["elleBelirsiz"] = list(s42["elleBelirsiz"]) + [["kart KT7", "S162 = B"], ["kart KT6", "SK-37"]]
s42["aciklama"] += (" · bakım 17 (§28 Y17-5): T7 S162 = B alanı (kart carinin bütün açık borcunu taşıyor + faturasız iade) — kart toplamı, taksit Ödenen'leri ve gecikmiş SUS (BİLİNEN SINIR); "
                    "'Tahsil Edilen 0', 'Kalan 600', bakiye yazılır (S158 A'nın örneği); T6 satış kartı carinin tek borcu + iade — SK-37 SUS")
bicim.yaz(p, s42)

# ── d44 (Y17-1 / Y17-5): X12 S159'un örneği AYNEN — KABUL, bakiye −100; Y4 S162 alanı (kart + tahsilat + iade, başka borç yok) — taksit Ödenen SUS
p, s44 = oku("d44-c5-s155-s158")
for k_ in ("adim:x12t:durum", "k1:cari:X12:bakiye"):
    assert k_ in s44["elleYok"], k_
s44["elleYok"] = [k_ for k_ in s44["elleYok"] if k_ not in ("adim:x12t:durum", "k1:cari:X12:bakiye")]
s44["elleBeklenen"].update({"adim:x12t:durum": "ok", "k1:cari:X12:bakiye": -10000, "k1:cari:X12:gecikmis": 0})
eski = len(s44["elleBelirsiz"])
s44["elleBelirsiz"] = [x for x in s44["elleBelirsiz"] if x != ["adım x12t", "S155", "SK-35", "KULLANICIYA SORULMALI"]]
assert len(s44["elleBelirsiz"]) == eski - 1
sus44 = ["k1:kart:KY4:taksit1:odenen", "k1:kart:KY4:taksit2:odenen", "k1:kart:KY4:taksit3:odenen"]
for k_ in sus44:
    assert k_ in s44["elleBeklenen"], k_
    del s44["elleBeklenen"][k_]
s44["elleYok"] = list(s44["elleYok"]) + sus44 + ["k1:kart:KY4:toplam", "k1:cari:Y4:gecikmis"]
s44["elleBelirsiz"] = list(s44["elleBelirsiz"]) + [["kart KY4", "S162 = B"]]
s44["aciklama"] += (" · bakım 17 (§28): X12 S159 A — KABUL, bakiye −100, açık şüpheli 0 (SK-35 kalktı); Y4 S162 = B alanı — kart toplamı / taksit Ödenen / gecikmiş SUS, 'Tahsil Edilen 300',"
                    " 'Kalan 300', bakiye yazılır")
bicim.yaz(p, s44)
print("d45 yazıldı (%d elle denetim, %d elleYok, %d elleBelirsiz); d30 / d42 / d43 / d44 güncellendi" % (len(B), len(Y), len(BL)))
