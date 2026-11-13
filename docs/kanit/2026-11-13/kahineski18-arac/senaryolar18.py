#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kâhin bakımı 18 (cari; S165 A — kart tahsilatı sınırı yalnız karttan alınan parayı sayar, S118 B OKUMASI — avansla ödenmiş kısım sınırı küçültmez, S166 = B BİLİNEN SINIR): yeni elle senaryo d46 +
d45 A6 / d42 T6'nın karar gereği güncellenmesi. Elle değerler KARAR METNİNDEN ve KARARLAR.md §29 Y18-1 … Y18-4'ten elle hesaplandı (kâhin koşulmadan — ders 40); tutarlar kuruş. Program AÇILMAZ.

  python3 -I senaryolar18.py <test/bagimsiz/cari/senaryolar>      (bir kez koşar — eski hâli assert'le denetler)
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bicim  # noqa: E402

D = sys.argv[1]
BUGUN = "2026-06-15"
KONTROL = {"id": "k1", "islem": "kontrol", "gecikmis": True, "gorunumToplam": True, "acikToplam": True}
A, B, Y, BL = [], {}, [], []
isim = {"A7": "Ata İade Sonra Ret", "A8": "Aysel İade Sonra Avans Yaz",
        "Q7": "Kaan Avanslı Yanıtsız", "Q8": "Kerem Avanslı Aşan Seçenekli", "Q9": "Kenan Avanslı Aşan Yanıtsız",
        "R1": "Rıza Örnek Tam Kalan", "R2": "Rana Örnek Aşan Yanıtsız", "R3": "Rüya Örnek Aşan Seçenekli"}
for c in ("A7", "A8", "R1", "R2", "R3"):
    A.append({"id": "c" + c.lower(), "islem": "cari_ac", "ad": c, "isim": isim[c], "tarih": "2026-03-01"})
for c in ("Q7", "Q8", "Q9"):
    A.append({"id": "c" + c.lower(), "islem": "cari_ac", "ad": c, "isim": isim[c], "tarih": "2026-04-01"})

# ── S165 = A — kararın örneği AYNEN: Borç 900 + Borç Z 500 (vade 30.06) → kart 900 (3 × 300; 01.04 / 01.05 / 01.06) → faturasız stok iadesi 300 → karta 700 sormadan KABUL (K = 900),
#    bakiye 400; ardından aynı karta 600: K = 900 − 700 = 200 → A7 seçeneksiz RET (bakiye 400 kalır), A8 'Fazlasını Avans Yaz' → KABUL (Y18-3 (1) — S154 B değer)
for c in ("A7", "A8"):
    lc = c.lower()
    A += [{"id": lc + "x", "islem": "borc", "cari": c, "tutar": "900", "tarih": "2026-03-01"},
          {"id": lc + "z", "islem": "borc", "cari": c, "tutar": "500", "tarih": "2026-03-01", "vade": "2026-06-30"},
          {"id": "k" + lc, "islem": "kart_ac", "ad": "K" + c, "cari": c, "tutar": "900", "taksit": 3, "ilkVade": "2026-04-01", "tarih": "2026-03-15", "mevcut": True},
          {"id": lc + "i", "islem": "stok_iade", "cari": c, "tutar": "300", "tarih": "2026-04-10"},
          {"id": "k" + lc + "t", "islem": "kart_tahsilat", "kayit": "K" + c, "tutar": "700", "tarih": "2026-05-10"}]
A.append({"id": "ka7u", "islem": "kart_tahsilat", "kayit": "KA7", "tutar": "600", "tarih": "2026-05-20"})
A.append({"id": "ka8u", "islem": "kart_tahsilat", "kayit": "KA8", "tutar": "600", "tarih": "2026-05-20", "fazlasiniAvansYaz": True})
# A7: 700 → kartın taksitlerini kart parası önce kapatır (C13.4 (3) bağ — §28 d45 A6B ile aynı adımlar): taksit 300 / 300 / 100 (3. taksitin 200'ü iade), iadenin artanı 100 Borç Z'ye → Z 400;
#     'Tahsil Edilen' 700 (iade sayılmaz — S158); 600 RET → hiçbir şey değişmez
B.update({"adim:ka7t:durum": "ok", "adim:ka7u:durum": "ret", "k1:cari:A7:bakiye": 40000, "k1:cari:A7:gecikmis": 0,
          "k1:kart:KA7:odenen": 70000, "k1:kart:KA7:kalan": 0, "k1:kart:KA7:taksit1:odenen": 30000, "k1:kart:KA7:taksit2:odenen": 30000, "k1:kart:KA7:taksit3:odenen": 10000,
          "k1:hareket:a7z:kalan": 40000})
# A8: 600 seçenekli → KABUL; karttan alınan para 1.300 (> 900): taksitler tamamen kart parasıyla 300 / 300 / 300, iade 300 + bağ fazlası 400 Borç Z'ye (500 kapanır, 200 avans);
#     bakiye 900 + 500 − 300 − 700 − 600 = −200; 'Tahsil Edilen' 1.300 (S154 B — 'Fazlasını Avans Yaz' ile kapanan kart; iade payı para değil)
B.update({"adim:ka8t:durum": "ok", "adim:ka8u:durum": "ok", "k1:cari:A8:bakiye": -20000, "k1:cari:A8:gecikmis": 0,
          "k1:kart:KA8:odenen": 130000, "k1:kart:KA8:kalan": 0, "k1:kart:KA8:taksit1:odenen": 30000, "k1:kart:KA8:taksit2:odenen": 30000, "k1:kart:KA8:taksit3:odenen": 30000,
          "k1:hareket:a8z:kalan": 0})

# ── S118 = B OKUMASI — SK-36 (a)'nın kendi örneği: tahsilat 1.000 (01.05, avans) → stoktan taksitli satış 600 (05.05; 2 × 300, 01.06 / 01.07 — avansla 'Bitti', S101 A) → karta Taksit Tahsilatı
#    Q7 300 yanıtsız: K = 600 ≥ 300 → soru yok, KABUL, bakiye −700 · Q8 700 'Fazlasını Avans Yaz' (K 600 < 700) → KABUL, bakiye −1.100 ('Tahsil Edilen' S144 = C SUS — Y18-3 (2)) ·
#    Q9 700 yanıtsız → RET, bakiye −400
for c, tutar, sec in (("Q7", "300", False), ("Q8", "700", True), ("Q9", "700", False)):
    lc = c.lower()
    A += [{"id": lc + "t", "islem": "tahsilat", "cari": c, "tutar": "1000", "tarih": "2026-05-01"},
          {"id": "k" + lc, "islem": "stok_satis_taksit", "ad": "K" + c, "cari": c, "tutar": "600", "tarih": "2026-05-05", "taksit": 2, "ilkVade": "2026-06-01"}]
    a = {"id": lc + "k", "islem": "kart_tahsilat", "kayit": "K" + c, "tutar": tutar, "tarih": "2026-05-10"}
    if sec:
        a["fazlasiniAvansYaz"] = True
    A.append(a)
B.update({"adim:q7k:durum": "ok", "k1:cari:Q7:bakiye": -70000, "k1:cari:Q7:gecikmis": 0, "k1:cari:Q7:acikToplam": 0,
          "k1:kart:KQ7:toplam": 60000, "k1:kart:KQ7:kalan": 0, "k1:kart:KQ7:taksit1:odenen": 30000, "k1:kart:KQ7:taksit2:odenen": 30000,
          "adim:q8k:durum": "ok", "k1:cari:Q8:bakiye": -110000, "k1:cari:Q8:gecikmis": 0,
          "k1:kart:KQ8:kalan": 0, "k1:kart:KQ8:taksit1:odenen": 30000, "k1:kart:KQ8:taksit2:odenen": 30000,
          "adim:q9k:durum": "ret", "k1:cari:Q9:bakiye": -40000, "k1:cari:Q9:gecikmis": 0,
          "k1:kart:KQ9:kalan": 0, "k1:kart:KQ9:taksit1:odenen": 30000, "k1:kart:KQ9:taksit2:odenen": 30000})
Y += ["k1:kart:KQ7:odenen", "k1:kart:KQ8:odenen"]
BL += [["kart KQ7", "S144 = C"], ["kart KQ8", "S144 = C"]]

# ── S118'in KENDİ örneği: Borç 1.000 (01.03) + Borç 200 (02.03) → kart 1.000 (2 × 500; 01.04 / 01.05) + kart 200 (1 × 200; 01.07) → karttan 300 (05.04; K 1.000) → küçük karta 300
#    'Fazlasını Avans Yaz' (06.04; K 200 < 300 — fazla 100 avans; tek kuyrukta büyük kartın 1. taksitine sayılır, taksit satırlarında kalan 600) → büyük karta:
#    R1 700 yanıtsız: K = 1.000 − 300 = 700 ≥ 700 → KABUL (bakiye 1.200 − 1.300 = −100) · R2 701 yanıtsız → RET (bakiye 600; kart Kalan 600 — 'cari avansı düşülmüş' gösterim, S118 / S129) ·
#    R3 701 'Fazlasını Avans Yaz' → KABUL, fazlası avans (bakiye −101; 'Tahsil Edilen' 1.001 — S154 B)
for c, tutar, sec in (("R1", "700", False), ("R2", "701", False), ("R3", "701", True)):
    lc = c.lower()
    A += [{"id": lc + "x", "islem": "borc", "cari": c, "tutar": "1000", "tarih": "2026-03-01"},
          {"id": lc + "y", "islem": "borc", "cari": c, "tutar": "200", "tarih": "2026-03-02"},
          {"id": "k" + lc, "islem": "kart_ac", "ad": "K" + c, "cari": c, "tutar": "1000", "taksit": 2, "ilkVade": "2026-04-01", "tarih": "2026-03-15", "mevcut": True},
          {"id": "k" + lc + "b", "islem": "kart_ac", "ad": "K" + c + "B", "cari": c, "tutar": "200", "taksit": 1, "ilkVade": "2026-07-01", "tarih": "2026-03-16", "mevcut": True},
          {"id": "k" + lc + "t", "islem": "kart_tahsilat", "kayit": "K" + c, "tutar": "300", "tarih": "2026-04-05"},
          {"id": "k" + lc + "bt", "islem": "kart_tahsilat", "kayit": "K" + c + "B", "tutar": "300", "tarih": "2026-04-06", "fazlasiniAvansYaz": True}]
    a = {"id": "k" + lc + "u", "islem": "kart_tahsilat", "kayit": "K" + c, "tutar": tutar, "tarih": "2026-05-10"}
    if sec:
        a["fazlasiniAvansYaz"] = True
    A.append(a)
for c in ("R1", "R2", "R3"):
    B.update({"adim:k%sbt:durum" % c.lower(): "ok", "k1:kart:K%sB:odenen" % c: 30000, "k1:kart:K%sB:kalan" % c: 0, "k1:kart:K%sB:taksit1:odenen" % c: 20000})
B.update({"adim:kr1u:durum": "ok", "k1:cari:R1:bakiye": -10000, "k1:cari:R1:gecikmis": 0,
          "k1:kart:KR1:odenen": 100000, "k1:kart:KR1:kalan": 0, "k1:kart:KR1:taksit1:odenen": 50000, "k1:kart:KR1:taksit2:odenen": 50000,
          "adim:kr2u:durum": "ret", "k1:cari:R2:bakiye": 60000, "k1:cari:R2:gecikmis": 60000,
          "k1:kart:KR2:odenen": 40000, "k1:kart:KR2:kalan": 60000, "k1:kart:KR2:taksit1:odenen": 40000, "k1:kart:KR2:taksit2:odenen": 0,
          "adim:kr3u:durum": "ok", "k1:cari:R3:bakiye": -10100, "k1:cari:R3:gecikmis": 0,
          "k1:kart:KR3:odenen": 100100, "k1:kart:KR3:kalan": 0, "k1:kart:KR3:taksit1:odenen": 50000, "k1:kart:KR3:taksit2:odenen": 50000})
assert all(k_ not in B for k_ in Y)
s = {"dil": "destekofis-cari/3", "ad": "d46-c5-s165-s118-sinir", "bugun": BUGUN,
     "aciklama": ("Bakım 18: S165 A — karttan tahsilat sınırı yalnız karttan alınan parayı sayar (kararın örneği AYNEN: A7 700 sormadan KABUL, bakiye 400, ardından 600 RET — kalan 200; A8 aynı 600 "
                  "'Fazlasını Avans Yaz' — KABUL, 'Tahsil Edilen 1.300', bakiye −200: S154 B para dışı paylı kartta); S118 B OKUMASI — avansla ödenmiş kısım sınırı küçültmez (Q7 SK-36 (a)'nın "
                  "örneği: 300 yanıtsız KABUL, bakiye −700; Q8 K'yı aşan seçenekli KABUL — 'Tahsil Edilen' S144 = C SUS; Q9 K'yı aşan yanıtsız RET) ve S118'in kendi örneği (başka karttan 100 avans: "
                  "R1 700 yanıtsız KABUL, R2 701 yanıtsız RET — Kalan 600, R3 701 seçenekli KABUL)"),
     "dayanak": "KARARLAR.md §29 (Y18-1 … Y18-3), §28 Y17-2 / Y17-3, §27 Y16-8, §25 S129, §18 S101, §13 C13.4 (3) / (4)",
     "elleBeklenen": B, "elleYok": Y, "elleBelirsiz": BL, "adimlar": A + [KONTROL]}
bicim.yaz(os.path.join(D, "d46-c5-s165-s118-sinir.json"), s)


def oku(ad):
    p = os.path.join(D, ad + ".json")
    with open(p, encoding="utf-8") as f:
        return p, json.load(f)


# ── d45 (Y18-2 (1)): A6 — S165'in kendi örneği; bakım 17'de SK-36 SUS → DEĞER = KABUL (A6B'nin değerleriyle aynı)
p, s45 = oku("d45-c5-s159-s154-s162-s163")
for k_ in ("adim:ka6t:durum", "k1:cari:A6:bakiye"):
    assert k_ in s45["elleYok"], k_
s45["elleYok"] = [k_ for k_ in s45["elleYok"] if k_ not in ("adim:ka6t:durum", "k1:cari:A6:bakiye")]
eski = len(s45["elleBelirsiz"])
s45["elleBelirsiz"] = [x for x in s45["elleBelirsiz"] if x != ["adım ka6t", "SK-36", "KULLANICIYA SORULMALI"]]
assert len(s45["elleBelirsiz"]) == eski - 1
for k_ in ("adim:ka6t:durum", "k1:cari:A6:bakiye"):
    assert k_ not in s45["elleBeklenen"]
s45["elleBeklenen"].update({"adim:ka6t:durum": "ok", "k1:cari:A6:bakiye": 40000, "k1:cari:A6:gecikmis": 0, "k1:kart:KA6:odenen": 70000, "k1:kart:KA6:kalan": 0,
                            "k1:kart:KA6:taksit1:odenen": 30000, "k1:kart:KA6:taksit2:odenen": 30000, "k1:kart:KA6:taksit3:odenen": 10000, "k1:hareket:a6z:kalan": 40000})
s45["aciklama"] += (" · bakım 18 (§29 Y18-2 (1)): A6 S165 A — iade payı kartın kendi kalanını küçültmez (K 900 ≥ 700): sormadan KABUL, bakiye 400; değerler A6B ile aynı (SK-36 kalktı)")
bicim.yaz(p, s45)

# ── d42 (Y18-4): T6 satış kartı — S166 = B: susma aynen, neden metni BİLİNEN SINIR
p, s42 = oku("d42-c5-s140-s151-satis-karti-iade")
i_ = s42["elleBelirsiz"].index(["kart KT6", "SK-37"])
s42["elleBelirsiz"][i_] = ["kart KT6", "S166 = B", "BİLİNEN SINIR"]
s42["aciklama"] += " · bakım 18 (§29 Y18-4): T6 S166 = B — satış kartı kolu da BİLİNEN SINIR (susma aynen; SK-37 kalktı)"
bicim.yaz(p, s42)
print("d46 yazıldı (%d elle denetim, %d elleYok, %d elleBelirsiz); d45 A6 ve d42 T6 güncellendi" % (len(B), len(Y), len(BL)))
