#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Cari kâhini bakımı 28 (§40): yeni d60 elle senaryosunu yazar — S255 = A (Mevcut Borç kartının içine aldığı faturaya BAĞLI ödeme) ve S254 = C (iki kart + faturasız stok iadesi — SUS).
Elle beklenenler KARAR METİNLERİNDEN (girdi §1: S255 = A ve KAPSAM; §2: S254 = C ve KAPSAM) ve §40'ın yorumlarından (Y28-1 … Y28-7), kâhin KOŞULMADAN elle hesaplandı (her satırın yanında hesap);
model.py'nin çıktısından TÜRETİLMEZ (ders 5, 40). Bakım 27'nin üreteci (kahin-cari27-arac/uret-d59.py) yardımcılarının uyarlaması. Kullanım: python3 -I uret-d60.py <senaryolar klasörü>"""
import json
import os
import sys

HEDEF = sys.argv[1]
TL = 100  # kuruş
E, Y, B = {}, [], []


def cr(k, c, bakiye, gecikmis, acik=None, esit=True):
    E["%s:cari:%s:bakiye" % (k, c)] = bakiye * TL
    E["%s:cari:%s:gecikmis" % (k, c)] = gecikmis * TL
    if acik is not None:
        E["%s:cari:%s:acikToplam" % (k, c)] = acik * TL
        E["%s:cari:%s:acikEsitBakiye" % (k, c)] = esit


def kr(k, no, toplam, odenen, kalan):
    E["%s:kart:%s:var" % (k, no)] = True
    E["%s:kart:%s:mevcutBorc" % (k, no)] = True
    E["%s:kart:%s:toplam" % (k, no)] = toplam * TL
    E["%s:kart:%s:odenen" % (k, no)] = odenen * TL
    E["%s:kart:%s:kalan" % (k, no)] = kalan * TL


def ft(k, f, kendi, gosterilen, taksitte):
    """§35 Y23-2 / Y23-3: kendi açık, gösterilen (kart ve liste), kartta = kendi − gösterilen, 'Taksitte' (kart + liste); taksitte None → Y23-6 (i) SUS (kendi 0, kartlı fatura)."""
    E["%s:fatura:%s:acik" % (k, f)] = kendi * TL
    for yer in ("gosterilen", "liste:gosterilen"):
        E["%s:fatura:%s:%s" % (k, f, yer)] = gosterilen * TL
    E["%s:fatura:%s:kartta" % (k, f)] = (kendi - gosterilen) * TL
    if taksitte is None:
        Y.extend(["%s:fatura:%s:taksitte" % (k, f), "%s:fatura:%s:liste:taksitte" % (k, f)])
        B.append(["fatura %s" % f, "Y23-6 (i)"])
    else:
        for yer in ("taksitte", "liste:taksitte"):
            E["%s:fatura:%s:%s" % (k, f, yer)] = taksitte


def ok(*ids):
    for i in ids:
        E["adim:%s:durum" % i] = "ok"


def cari(id_, ad, isim, tarih="2026-09-01"):
    return {"id": id_, "islem": "cari_ac", "ad": ad, "isim": isim, "tarih": tarih}


def fatura(id_, ad, c, tutar, adet, tarih):
    return {"id": id_, "islem": "fatura", "ad": ad, "cari": c, "tur": "satis", "tutar": str(tutar), "adet": adet, "tarih": tarih}


def kart(id_, ad, c, tutar, ilk, tarih, n=3):
    return {"id": id_, "islem": "kart_ac", "ad": ad, "cari": c, "tutar": str(tutar), "taksit": n, "ilkVade": ilk, "tarih": tarih, "mevcut": True}


def tah(id_, c, tutar, tarih, f=None):
    a = {"id": id_, "islem": "tahsilat", "cari": c, "tutar": str(tutar), "tarih": tarih}
    if f:
        a["fatura"] = f
    return a


A = []
# ───────── S255 = A — bugün 20.10.2026; her V carisinde F 900 (3 adet, 01.09 — vade = belge günü, "vadesi geçmiş"), elle Mevcut Borç kartı 600 (02.09; 3 × 200 — 05.10 / 05.11 / 05.12):
#   kart açılırken açık borç yalnız F (900 > 600) → S200 / S243 = A (E = 0): kart F'nin 600'ünü içine alır; F'nin gösterilen açığı 300 (kuyrukta, vadesi 01.09)
V = [("V1", "Vedat Bağlı 300"), ("V2", "Veli Bağlı 600"), ("V3", "Vural Bağlı 900"), ("V4", "Vasfi Bağlı 1200"), ("V5", "Volkan Bağsız 900"), ("V6", "Vahap Bağsız 600"),
     ("V7", "Vecdi Tamamı Kartta"), ("V8", "Vildan İade Sonra Bağlı"), ("V9", "Vuslat Büyük İade Sonra Bağlı"), ("V10", "Vefa İade İptali Sonra Bağlı"), ("V11", "Veysel Sil Geri Yükle"),
     ("V12", "Vahit Kart Öncesi Bağlı")]
for c, isim in V:
    A.append(cari("c" + c.lower(), c, isim))
for c, _ in V:
    A.append(fatura("f" + c.lower(), "F" + c, c, 900, 3, "2026-09-01"))
# S254 = C — Q1 / Q2: iki elle Borç 600 (01.09), iki Mevcut Borç kartı 600 (K1 02.09, ilk 05.10; K2 03.09, ilk 05.11; 3 × 200), 20.10 faturasız stok iadesi 300; Q2'de ayrıca 15.10 satış faturası 500
A += [cari("cq1", "Q1", "Kuzey İki Kart İade"), cari("cq2", "Q2", "Kerem İki Kart Faturalı İade")]
for c in ("Q1", "Q2"):
    A += [{"id": "b1" + c.lower(), "islem": "borc", "cari": c, "tutar": "600", "tarih": "2026-09-01"},
          {"id": "b2" + c.lower(), "islem": "borc", "cari": c, "tutar": "600", "tarih": "2026-09-01"}]
for c, _ in V:
    if c == "V12":
        continue
    A.append(kart("k" + c.lower(), "K" + c, c, 900 if c == "V7" else 600, "2026-10-05", "2026-09-02"))
A += [tah("tv12", "V12", 300, "2026-09-03", "FV12"), kart("kv12", "KV12", "V12", 600, "2026-10-05", "2026-09-05")]  # V12: bağlı ödeme kart AÇILMADAN önce (Y28-2)
for c in ("Q1", "Q2"):
    A += [kart("k1" + c.lower(), "K1" + c, c, 600, "2026-10-05", "2026-09-02"), kart("k2" + c.lower(), "K2" + c, c, 600, "2026-11-05", "2026-09-03")]
# iadeler (numaralı belgeler tarih sırasıyla — §19 Y7-1): 10.09
A += [{"id": "iv8", "islem": "iade", "ad": "IV8", "fatura": "FV8", "adet": 1, "tarih": "2026-09-10"},
      {"id": "iv9", "islem": "iade", "ad": "IV9", "fatura": "FV9", "adet": 2, "tarih": "2026-09-10"},
      {"id": "iv10", "islem": "iade", "ad": "IV10", "fatura": "FV10", "adet": 2, "tarih": "2026-09-10"}]
A.append(fatura("fq2", "FQ2", "Q2", 500, 1, "2026-10-15"))
A.append({"id": "iiv10", "islem": "fatura_iptal", "fatura": "IV10"})
# 20.10 ödemeler
A += [tah("tv1", "V1", 300, "2026-10-20", "FV1"), tah("tv2", "V2", 600, "2026-10-20", "FV2"), tah("tv3", "V3", 900, "2026-10-20", "FV3"), tah("tv4", "V4", 1200, "2026-10-20", "FV4"),
      tah("tv5", "V5", 900, "2026-10-20"), tah("tv6", "V6", 600, "2026-10-20"), tah("tv7", "V7", 300, "2026-10-20", "FV7"), tah("tv8", "V8", 600, "2026-10-20", "FV8"),
      tah("tv9", "V9", 300, "2026-10-20", "FV9"), tah("tv10", "V10", 600, "2026-10-20", "FV10"), tah("tv11", "V11", 600, "2026-10-20", "FV11")]
A += [{"id": "sq1", "islem": "stok_iade", "cari": "Q1", "tutar": "300", "tarih": "2026-10-20"}, {"id": "sq2", "islem": "stok_iade", "cari": "Q2", "tutar": "300", "tarih": "2026-10-20"}]
A += [{"id": "xv11", "islem": "hareket_sil", "hareket": "tv11"}, {"id": "k0", "islem": "kontrol", "gecikmis": True, "acikToplam": True},
      {"id": "gv11", "islem": "hareket_geri_yukle", "hareket": "tv11"}, {"id": "k1", "islem": "kontrol", "gecikmis": True, "acikToplam": True}]
ok("tv1", "tv2", "tv3", "tv4", "tv5", "tv6", "tv7", "tv8", "tv9", "tv10", "tv11", "tv12", "iv8", "iv9", "iv10", "iiv10", "sq1", "sq2", "xv11", "gv11", "kv1", "kv7", "kv12", "k1q1", "k2q1", "k1q2", "k2q2")

for k in ("k0", "k1"):
    # V1 — bağlı 300 = gösterilen açık: F'nin kuyruktaki 300'ü kapanır; kart dokunulmaz (600 / Tahsil 0 / Kalan 600); F kendi = 0 + 600 − 0 = 600, gösterilen 0, kartta 600, 'Taksitte' (Y23-3);
    #   bakiye 900 − 300 = 600; gecikmiş: kartın 05.10 taksiti 200 (< 20.10); açık toplamı Σ fatura açığı 600 = bakiye
    cr(k, "V1", 600, 200, 600); kr(k, "KV1", 600, 0, 600); ft(k, "FV1", 600, 0, True)
    # V2 — kararın örneği, bağlı 600: önce gösterilen 300 (F'nin kuyruk kalanı) kapanır; fazla 300 20.10'da tek kuyruğa (S2): açık kalemler kartın 05.10 200 / 05.11 200 / 05.12 200 → 05.10 200 + 05.11 100;
    #   kart Tahsil 300 · Kalan 300; F kendi = 0 + 600 − 300 = 300, gösterilen 0, kartta 300, 'Taksitte' true; bakiye 900 − 600 = 300; gecikmiş 0 (05.10 ödendi, 05.11 gelmedi); açık toplamı 300 = bakiye
    cr(k, "V2", 300, 0, 300); kr(k, "KV2", 600, 300, 300); ft(k, "FV2", 300, 0, True)
    # V3 — bağlı 900: gösterilen 300 + fazla 600 → kartın üç taksiti (200 + 200 + 200): kart Kalan 0, Tahsil 600; F kendi 0 → gösterilen 0, kartta 0, 'Taksitte' SUS (Y23-6 (i)); bakiye 0; gecikmiş 0; açık toplamı 0 = bakiye
    cr(k, "V3", 0, 0, 0); kr(k, "KV3", 600, 600, 0); ft(k, "FV3", 0, 0, None)
    # V4 — bağlı 1.200: gösterilen 300 + kart 600 + artan 300 avans → kart Kalan 0; bakiye 900 − 1.200 = −300; gecikmiş 0; açık toplamı 0 ≠ bakiye (avans açık toplamına girmez)
    cr(k, "V4", -300, 0, 0, False); kr(k, "KV4", 600, 600, 0); ft(k, "FV4", 0, 0, None)
    # V5 — bağsız 900 (20.10): S2 sırası — F'nin kuyruk kalanı 300 (vade 01.09), sonra kartın 05.10 / 05.11 / 05.12 → hepsi kapanır: bağlı 900 (V3) ile AYNI
    cr(k, "V5", 0, 0, 0); kr(k, "KV5", 600, 600, 0); ft(k, "FV5", 0, 0, None)
    # V6 — bağsız 600: F 300 + 05.10 200 + 05.11 100 → bağlı 600 (V2) ile AYNI
    cr(k, "V6", 300, 0, 300); kr(k, "KV6", 600, 300, 300); ft(k, "FV6", 300, 0, True)
    # V7 — faturanın TAMAMI kartta (kart 900 = açık borç; 3 × 300): bağlı 300 → gösterilen 0, bağın TAMAMI havuza → kartın 05.10 300; kart Tahsil 300 · Kalan 600; F kendi = 0 + 900 − 300 = 600, kartta 600,
    #   'Taksitte' true; bakiye 600; gecikmiş 0 (05.10 ödendi); açık toplamı 600 = bakiye
    cr(k, "V7", 600, 0, 600); kr(k, "KV7", 900, 300, 600); ft(k, "FV7", 600, 0, True)
    # V8 — 10.09 iade 1 adet (300): S239 = A — önce kartın dışındaki açık (300) kapanır, kart değişmez (600); 20.10 bağlı 600 → gösterilen 0 → TAMAMI havuza → kartın üç taksiti: Kalan 0, Tahsil 600;
    #   F kendi = 0 + 600 − 600 = 0 (Taksitte SUS); iade belgesinin açığı 0; bakiye 900 − 300 − 600 = 0; gecikmiş 0; açık toplamı 0 = bakiye
    cr(k, "V8", 0, 0, 0); kr(k, "KV8", 600, 600, 0); ft(k, "FV8", 0, 0, None); E["%s:fatura:IV8:acik" % k] = 0
    # V9 — 10.09 iade 2 adet (600): S239 = A — önce dış açık 300, kalan 300 kartı küçültür (karar (4) — vadesi en önce gelen açık taksitten: 05.10 200 → 0, 05.11 200 → 100) → kart 300 (0 / 100 / 200);
    #   20.10 bağlı 300 → gösterilen 0 → TAMAMI havuza → 05.11 100 + 05.12 200 → kart Kalan 0, Tahsil 300; F kendi 0; bakiye 900 − 600 − 300 = 0; gecikmiş 0; açık toplamı 0 = bakiye
    cr(k, "V9", 0, 0, 0); kr(k, "KV9", 300, 300, 0); ft(k, "FV9", 0, 0, None); E["%s:fatura:IV9:acik" % k] = 0
    # V10 — iade 2 adet, sonra iade İPTAL (küçülme geri alınır — KAPSAM (c) §36 aynen; kart 600, F gösterilen 300), 20.10 bağlı 600 → V2 ile AYNI; iade belgesi iptal
    cr(k, "V10", 300, 0, 300); kr(k, "KV10", 600, 300, 300); ft(k, "FV10", 300, 0, True); E["%s:fatura:IV10:durum" % k] = "iptal"
    # V12 — bağlı 300 kart AÇILMADAN önce (03.09; Y28-2 — bugünkü kural): F 600 kalır, kart 600 (05.09) F'nin 600'ünü içine alır → V1 ile AYNI sayılar
    cr(k, "V12", 600, 200, 600); kr(k, "KV12", 600, 0, 600); ft(k, "FV12", 600, 0, True)
    # Q1 / Q2 — S254 = C (Y28-7): bakiye yazılır (Q1: 600 + 600 − 300 = 900; Q2: 1.200 + 500 − 300 = 1.400), kartlar var; hangi kartın küçüleceğine bağlı her şey SUS (kartların toplamı dahil)
    E["%s:cari:Q1:bakiye" % k] = 900 * TL
    E["%s:cari:Q2:bakiye" % k] = 1400 * TL
    for c in ("Q1", "Q2"):
        Y.extend(["%s:cari:%s:gecikmis" % (k, c), "%s:cari:%s:acikToplam" % (k, c), "%s:cari:%s:acikEsitBakiye" % (k, c),
                  "%s:hareket:b1%s:kalan" % (k, c.lower()), "%s:hareket:b2%s:kalan" % (k, c.lower())])
        for no in ("K1" + c, "K2" + c):
            E["%s:kart:%s:var" % (k, no)] = True
            E["%s:kart:%s:mevcutBorc" % (k, no)] = True
            Y.extend(["%s:kart:%s:toplam" % (k, no), "%s:kart:%s:odenen" % (k, no), "%s:kart:%s:kalan" % (k, no)])
        B.append(["cari %s" % c, "S254 = C"])
    Y.extend(["%s:fatura:FQ2:acik" % k, "%s:fatura:FQ2:gosterilen" % k, "%s:fatura:FQ2:kartta" % k])
# V11 — k0: bağlı 600 SİLİNDİ → ödemesizmiş gibi: kart 600 / 0 / 600; F kendi 900, gösterilen 300, kartta 600, 'Taksitte' değil; bakiye 900; gecikmiş F'nin kuyruk 300 (01.09) + kartın 05.10 200 = 500;
#   açık toplamı 900 = bakiye · k1: GERİ YÜKLENDİ (kendi tarihi 20.10, kimlik aynı — Y28-5) → V2 ile AYNI
cr("k0", "V11", 900, 500, 900); kr("k0", "KV11", 600, 0, 600); ft("k0", "FV11", 900, 300, False)
cr("k1", "V11", 300, 0, 300); kr("k1", "KV11", 600, 300, 300); ft("k1", "FV11", 300, 0, True)

d60 = {"dil": "destekofis-cari/3", "ad": "d60-c5-s255-s254-bagli-odeme-kartli-fatura",
       "aciklama": "Bakım 28 (§40): S255 = A — Mevcut Borç kartının içine aldığı faturaya BAĞLI tahsilat önce faturanın GÖSTERİLEN açığını kapatır, fazlası tek kuyruğa: kararın örneği (F 900, kart 600 = 3 × 200) bağlı 300 (V1) / 600 (V2) / "
                   "900 (V3) / 1.200 (V4) ve bağsız 900 (V5) / 600 (V6) karşılaştırması; faturanın tamamı kartta (V7); iadeden sonra bağlı ödeme (V8 dış açık, V9 kart küçülmüş); iade iptalinden sonra (V10); bağlı ödemenin "
                   "silinip geri yüklenmesi (V11 — k0 silinmiş, k1 geri yüklenmiş); kart açılmadan önceki bağlı ödeme bugünkü kural (V12). S254 = C — iki Mevcut Borç kartı + faturasız stok iadesi: hangi kartın küçüleceği SUS, bakiye "
                   "denetlenir (Q1; Q2 kart dışında da fatura). Bugün 20.10.2026. Elle tablo karar metinlerinden, kâhin koşulmadan (üreteç docs/kanit/2026-11-22/kahin-cari28-arac/uret-d60.py).",
       "dayanak": "KARARLAR.md §40 (Y28-1 … Y28-7), §35 Y23-2 / Y23-3 / Y23-6, §37 Y25-3, §36 Y24-3 / Y24-4, C13.4 (3), C6 S1", "bugun": "2026-10-20",
       "elleBeklenen": dict(E), "elleYok": list(Y), "elleBelirsiz": [b for i, b in enumerate(B) if b not in B[:i]], "adimlar": A}
with open(os.path.join(HEDEF, d60["ad"] + ".json"), "w", encoding="utf-8") as f:
    json.dump(d60, f, ensure_ascii=False, indent=1)
    f.write("\n")
print("d60: %d adım · elle %d + elleYok %d + belirsiz %d" % (len(A), len(E), len(Y), len(B)))
