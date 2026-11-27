#!/usr/bin/env python3
"""Bakım 11 elle senaryosu (S126 = A — bakiye kadar açılan, içine fatura da giren Taksitler kartına gelen ödeme kalemleri fatura DAHİL kartın içine alma sırasıyla, eskiden yeniye düşürür).
Bütün beklenen değerler bu betikte ELLE — kâhin koşulmadan, karar metninden (scratchpad/kahin-eski11-kararlar.md) ve KARARLAR.md §13 / §20 / §22 / §23'ten. Tutarlar kuruş.
Bugün 15.04.2026; kartlar 15.03'te (O = T: kart = carinin bütün açık borcu), taksitleri 01.04 / 01.05 / 01.06 (2 taksitlide 01.04 / 01.05). Kart tahsilatı kartın vadesi ilk gelen açık taksitine (bağ —
zamandan bağımsız, C13.4 (3)); bağsız tahsilat S2 + S50 ile kuyrukta (kartın tükettiği kalemler kuyrukta 0 — yalnız taksitler kalır, C13.4 (6)). gecikmiş = Σ kuyruk kalanı {vade < bugün} (C13.5).
Adımların yeri sonra g1-sirala.py ile (G1 — her carinin kendi sırası aynen).
Kullanım: python3 -I yeni-senaryolar11.py <senaryolar klasörü>"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bicim  # noqa: E402

D = sys.argv[1]
DIL = "destekofis-cari/3"
BUGUN = "2026-04-15"
K = "k1"
KONTROL = {"id": K, "islem": "kontrol", "gecikmis": True, "gorunumToplam": True, "acikToplam": True}


def ca(ad, isim, tel=None, tarih="2026-02-01", acilis=None):
    a = {"id": "c" + ad.lower(), "islem": "cari_ac", "ad": ad, "isim": isim, "tarih": tarih}
    if tel:
        a["tel"] = tel
    if acilis:
        a["acilis"] = acilis
    return a


def fat(id_, ad, cari, tutar, tarih):
    return {"id": id_, "islem": "fatura", "ad": ad, "cari": cari, "tutar": tutar, "tarih": tarih}


def borc(id_, cari, tutar, tarih, vade=None):
    a = {"id": id_, "islem": "borc", "cari": cari, "tutar": tutar, "tarih": tarih}
    if vade:
        a["vade"] = vade
    return a


def tah(id_, cari, tutar, tarih):
    return {"id": id_, "islem": "tahsilat", "cari": cari, "tutar": tutar, "tarih": tarih}


def ktah(id_, kart_ad, tutar, tarih):
    return {"id": id_, "islem": "kart_tahsilat", "kayit": kart_ad, "tutar": tutar, "tarih": tarih}


def elle_kart(id_, ad, cari, tutar, taksit=3, ilk="2026-04-01", tarih="2026-03-15"):
    return {"id": id_, "islem": "kart_ac", "ad": ad, "cari": cari, "tutar": tutar, "taksit": taksit, "ilkVade": ilk, "tarih": tarih, "mevcut": True}


def kalem(tutar, gun, gunler, cari, kisi):
    return {"amount": tutar, "dueDate": gun, "direction": "in", "label": "Tahsil Edilecek Borç", "state": "overdue", "days": gunler, "cari": cari, "person": kisi}


def gorunum(h, tutar, gun, gunler, cari, kisi):
    """kartın dışında kalan (ya da kısmen alınan) elle kalem: takvim / Vade Takip / projeksiyon tutarı = kuyruk kalanı (§20 Y8-4; §23 Y11-10)"""
    v = {"amount": tutar, "date": gun, "direction": "in"}
    return {"%s:takvim:hareket:%s" % (K, h): kalem(tutar, gun, gunler, cari, kisi), "%s:vadeTakip:hareket:%s" % (K, h): v, "%s:projeksiyon:hareket:%s" % (K, h): dict(v)}


def yok3(h):
    """kuyruk kalanı 0 olan elle kalem (kartın tamamen içine aldığı): takvim / Vade Takip / projeksiyon kalemi yok"""
    return {"%s:takvim:hareket:%s" % (K, h): "yok", "%s:vadeTakip:hareket:%s" % (K, h): "yok", "%s:projeksiyon:hareket:%s" % (K, h): "yok"}


def kart(no, toplam, odenen, taksitler):
    b = {"%s:kart:%s:var" % (K, no): True, "%s:kart:%s:toplam" % (K, no): toplam, "%s:kart:%s:odenen" % (K, no): odenen, "%s:kart:%s:kalan" % (K, no): toplam - odenen,
         "%s:kart:%s:mevcutBorc" % (K, no): True}
    assert sum(taksitler) == odenen
    for i, v in enumerate(taksitler):
        b["%s:kart:%s:taksit%d:odenen" % (K, no, i + 1)] = v
    return b


def cari(ad, bakiye, gecikmis=None, acik=None):
    b = {"%s:cari:%s:bakiye" % (K, ad): bakiye}
    if gecikmis is not None:
        b["%s:cari:%s:gecikmis" % (K, ad)] = gecikmis
    if acik is not None:
        b["%s:cari:%s:acikToplam" % (K, ad)] = acik
        b["%s:cari:%s:acikEsitBakiye" % (K, ad)] = acik == bakiye
    return b


def fatura_kartta(ad, acik):
    """kartın tamamen içine aldığı satış faturası: açık = defter kalanı (kuyruk 0 + tüketilen − pay — §23 Y11-2); takvim kalemi DEĞİL (kuyruk kalanı 0 — Y11-10; K6.5 (1) net = 0)"""
    return {"%s:fatura:%s:acik" % (K, ad): acik, "%s:takvim:fatura:%s" % (K, ad): "yok"}


def fatura_ayri(ad, acik):
    """kartın içine almadığı (ya da kartsız carinin) satış faturası: takvim kalemi kendi açığıyla"""
    return {"%s:fatura:%s:acik" % (K, ad): acik, "%s:takvim:fatura:%s" % (K, ad): {"amount": acik, "direction": "in"} if acik > 0 else "yok"}


adim, bek, yok, belirsiz = [], {}, [], []


def ornek(c, isim, tel=None):
    """kararın örneği AYNEN: 01.03 fatura F 600 · 02.03 elle borç X 300 (vadesiz) · 15.03 kart 900 (3 × 300) — açık borç 900 = kart (O = T) ⇒ kartta F 600 + X 300 (M1e, S2 sırası F → X)."""
    lo = c.lower()
    return [ca(c, isim, tel), fat(lo + "f", c + "F", c, "600", "2026-03-01"), borc(lo + "x", c, "300", "2026-03-02"), elle_kart("k" + lo, "K" + c, c, "900")]


def sus(c, kart_no, toplam, bakiye, kalemler, parcalar, fatura_ad=None):
    """kâhinin SUSTUĞU cari (C13.4 (11) düzeni): yalnız bakiye ve kart tutarı yazılır; `belirsiz` kaydında nedenin parçaları"""
    bek.update(cari(c, bakiye))
    bek.update({"%s:kart:%s:var" % (K, kart_no): True, "%s:kart:%s:toplam" % (K, kart_no): toplam})
    yok.extend(["%s:cari:%s:gecikmis" % (K, c), "%s:kart:%s:kalan" % (K, kart_no)] + ["%s:hareket:%s:kalan" % (K, h) for h in kalemler] + ["%s:takvim:hareket:%s" % (K, kalemler[0])])
    if fatura_ad:
        yok.append("%s:fatura:%s:acik" % (K, fatura_ad))
    belirsiz.append(["cari %s tanımsız" % c] + parcalar)


# L1 — kararın örneği AYNEN: + 10.04 kart tahsilatı 300 (taksit 1). P = 300 ⇒ F'ye (içine alma sırasında ilk): F açık 0 + 600 − 300 = 300; X Kalan 0 + 300 − 0 = 300 (kararın sonucu).
#   gecikmiş 0 (F, X kuyrukta 0; taksit 1 ödendi; taksit 2 01.05); bakiye 900 − 300 = 600 = açık (300 + 300). (S126 B: X 0, F 600.)
adim += ornek("L1", "Lale Örnek") + [ktah("l1k", "KL1", "300", "2026-04-10")]
bek.update(cari("L1", 60000, 0, 60000))
bek.update(fatura_kartta("L1F", 30000))
bek.update({"k1:hareket:l1x:kalan": 30000})
bek.update(yok3("l1x"))
bek.update(kart("KL1", 90000, 30000, [30000, 0, 0]))

# L2 — ödeme ilk kalemi (F) TAM bitirir: kart tahsilatı 600 (taksit 1 + 2) ⇒ F açık 0, X Kalan 300. gecikmiş 0; bakiye 300 = açık (0 + 300).
adim += ornek("L2", "Leman Tam Biter") + [ktah("l2k", "KL2", "600", "2026-04-10")]
bek.update(cari("L2", 30000, 0, 30000))
bek.update(fatura_kartta("L2F", 0))
bek.update({"k1:hareket:l2x:kalan": 30000})
bek.update(yok3("l2x"))
bek.update(kart("KL2", 90000, 60000, [30000, 30000, 0]))

# L3 — ödeme F'yi aşıp X'e geçer: kart tahsilatı 700 (300 + 300 + 100) ⇒ F 0, X Kalan 300 − 100 = 200. gecikmiş 0; bakiye 200 = açık (0 + 200).
adim += ornek("L3", "Levent Aşar") + [ktah("l3k", "KL3", "700", "2026-04-10")]
bek.update(cari("L3", 20000, 0, 20000))
bek.update(fatura_kartta("L3F", 0))
bek.update({"k1:hareket:l3x:kalan": 20000})
bek.update(yok3("l3x"))
bek.update(kart("KL3", 90000, 70000, [30000, 30000, 10000]))

# L4 — kartı tamamen kapatır: kart tahsilatı 900 ⇒ F 0, X 0. gecikmiş 0; bakiye 0 = açık.
adim += ornek("L4", "Lütfiye Kapatır") + [ktah("l4k", "KL4", "900", "2026-04-10")]
bek.update(cari("L4", 0, 0, 0))
bek.update(fatura_kartta("L4F", 0))
bek.update({"k1:hareket:l4x:kalan": 0})
bek.update(yok3("l4x"))
bek.update(kart("KL4", 90000, 90000, [30000, 30000, 30000]))

# L5 — iki ödeme üst üste (Y11-5: birikimli — toplam 700 tek ödeme gibi): 05.04 kart tahsilatı 300 + 10.04 kart tahsilatı 400 ⇒ F 0, X 200. kart [300, 300, 100]; gecikmiş 0; bakiye 200.
#   (İkinci ödemede sıra baştan başlasaydı F −100 / X 300.)
adim += ornek("L5", "Lerzan İki Ödeme") + [ktah("l5k1", "KL5", "300", "2026-04-05"), ktah("l5k2", "KL5", "400", "2026-04-10")]
bek.update(cari("L5", 20000, 0, 20000))
bek.update(fatura_kartta("L5F", 0))
bek.update({"k1:hareket:l5x:kalan": 20000})
bek.update(yok3("l5x"))
bek.update(kart("KL5", 90000, 70000, [30000, 30000, 10000]))

# L6 — elle borç faturadan ESKİ (Y11-6 — sıra tersine): 01.03 X 300 · 05.03 F 600 · 15.03 kart 900 (kartta X 300 + F 600) · 10.04 kart tahsilatı 300 ⇒ X Kalan 0, F açık 600 (A'nın sonucu).
#   gecikmiş 0; bakiye 600 = açık (600 + 0).
adim += [ca("L6", "Leyla Elle Eski"), borc("l6x", "L6", "300", "2026-03-01"), fat("l6f", "L6F", "L6", "600", "2026-03-05"), elle_kart("kl6", "KL6", "L6", "900"),
         ktah("l6k", "KL6", "300", "2026-04-10")]
bek.update(cari("L6", 60000, 0, 60000))
bek.update(fatura_kartta("L6F", 60000))
bek.update({"k1:hareket:l6x:kalan": 0})
bek.update(yok3("l6x"))
bek.update(kart("KL6", 90000, 30000, [30000, 0, 0]))

# L7 — iki fatura + bir elle borç (Y11-6): 01.03 F1 400 · 02.03 X 300 · 03.03 F2 500 · 15.03 kart 1.200 (3 × 400) · 10.04 kart tahsilatı 600 (taksit 1 400 + taksit 2'nin 200'ü)
#   ⇒ sıra F1 → X → F2: F1 0, X Kalan 300 − 200 = 100, F2 500. gecikmiş 0; bakiye 1.200 − 600 = 600 = açık (0 + 100 + 500).
adim += [ca("L7", "Lamia İki Fatura"), fat("l7f1", "L7F1", "L7", "400", "2026-03-01"), borc("l7x", "L7", "300", "2026-03-02"), fat("l7f2", "L7F2", "L7", "500", "2026-03-03"),
         elle_kart("kl7", "KL7", "L7", "1200"), ktah("l7k", "KL7", "600", "2026-04-10")]
bek.update(cari("L7", 60000, 0, 60000))
bek.update(fatura_kartta("L7F1", 0))
bek.update(fatura_kartta("L7F2", 50000))
bek.update({"k1:hareket:l7x:kalan": 10000})
bek.update(yok3("l7x"))
bek.update(kart("KL7", 120000, 60000, [40000, 20000, 0]))

# L8 — S50 yolu (Y11-4): kararın örneği + 10.04 bağsız tahsilat 500 (kuyrukta yalnız taksitler: taksit 1 300 → taksit 2'nin 200'ü). P = 500 ⇒ F açık 100, X Kalan 300.
#   gecikmiş 0; bakiye 400 = açık (100 + 300).
adim += ornek("L8", "Lokman Bağsız") + [tah("l8t", "L8", "500", "2026-04-10")]
bek.update(cari("L8", 40000, 0, 40000))
bek.update(fatura_kartta("L8F", 10000))
bek.update({"k1:hareket:l8x:kalan": 30000})
bek.update(yok3("l8x"))
bek.update(kart("KL8", 90000, 50000, [30000, 20000, 0]))

# L9 — silme (Y11-5): kararın örneği + 10.04 kart tahsilatı 300 (taksit 1) · 12.04 bağsız tahsilat 300 (taksit 2 — S50) · 12.04 tahsilatı SİLİNİR ⇒ P 300: F 300, X 300.
#   gecikmiş 0; bakiye 600 = açık.
adim += ornek("L9", "Lâl Siler") + [ktah("l9k", "KL9", "300", "2026-04-10"), tah("l9t", "L9", "300", "2026-04-12"), {"id": "l9s", "islem": "hareket_sil", "hareket": "l9t", "cari": "L9"}]
bek.update(cari("L9", 60000, 0, 60000))
bek.update(fatura_kartta("L9F", 30000))
bek.update({"k1:hareket:l9x:kalan": 30000})
bek.update(yok3("l9x"))
bek.update(kart("KL9", 90000, 30000, [30000, 0, 0]))

# L10 — silme + geri yükleme: L9 ile aynı + silinen tahsilat geri yüklenir (kendi tarihinde 12.04 — taksit 2) ⇒ P 600: F 0, X 300. gecikmiş 0; bakiye 300 = açık.
adim += ornek("L10", "Lâl Geri Yükler") + [ktah("l10k", "KL10", "300", "2026-04-10"), tah("l10t", "L10", "300", "2026-04-12"),
                                          {"id": "l10s", "islem": "hareket_sil", "hareket": "l10t", "cari": "L10"},
                                          {"id": "l10g", "islem": "hareket_geri_yukle", "hareket": "l10t", "cari": "L10"}]
bek.update(cari("L10", 30000, 0, 30000))
bek.update(fatura_kartta("L10F", 0))
bek.update({"k1:hareket:l10x:kalan": 30000})
bek.update(yok3("l10x"))
bek.update(kart("KL10", 90000, 60000, [30000, 30000, 0]))

# L11 — P = 0 (Y11-3): kararın kartı, ödeme yok ⇒ F açık 600, X Kalan 300. gecikmiş = taksit 1 300 (01.04 < 15.04); bakiye 900 = açık.
adim += ornek("L11", "Lebibe Ödemesiz")
bek.update(cari("L11", 90000, 30000, 90000))
bek.update(fatura_kartta("L11F", 60000))
bek.update({"k1:hareket:l11x:kalan": 30000})
bek.update(yok3("l11x"))
bek.update(kart("KL11", 90000, 0, [0, 0, 0]))

# L12 — yalnız faturalar (Y11-7 — baş mimarın değerlendirmesine): 01.03 F1 400 · 05.03 F2 500 · 15.03 kart 900 · 10.04 kart tahsilatı 300 ⇒ F1 açık 100, F2 500.
#   gecikmiş 0; bakiye 600 = açık (100 + 500).
adim += [ca("L12", "Lerze Faturalar"), fat("l12f1", "L12F1", "L12", "400", "2026-03-01"), fat("l12f2", "L12F2", "L12", "500", "2026-03-05"), elle_kart("kl12", "KL12", "L12", "900"),
         ktah("l12k", "KL12", "300", "2026-04-10")]
bek.update(cari("L12", 60000, 0, 60000))
bek.update(fatura_kartta("L12F1", 10000))
bek.update(fatura_kartta("L12F2", 50000))
bek.update(kart("KL12", 90000, 30000, [30000, 0, 0]))

# L13 — Y11-8 (SUS — BİLİNEN SINIR S125 = C): 01.03 X 300 (vade 30.03) · 05.03 F 600 · 15.03 kart 900 · 10.04 kart tahsilatı 300 ⇒ vade sırası F → X (F 300, X 300) ↔ belge sırası X → F
#   (X 0, F 600) — ayrışıyor. Bakiye 600, kart tutarı 900.
adim += [ca("L13", "Leman Vade Ters"), borc("l13x", "L13", "300", "2026-03-01", "2026-03-30"), fat("l13f", "L13F", "L13", "600", "2026-03-05"), elle_kart("kl13", "KL13", "L13", "900"),
         ktah("l13k", "KL13", "300", "2026-04-10")]
sus("L13", "KL13", 90000, 60000, ["l13x"], ["S125 = C", "SK-23"], "L13F")

# L13b — L13 düzeni, kart tahsilatı 900 (kart tamamen ödenir) ⇒ iki sırada da F 0, X 0 (aynı pay → DEĞER). gecikmiş 0; bakiye 0.
adim += [ca("L13b", "Leman Vade Tam"), borc("l13bx", "L13b", "300", "2026-03-01", "2026-03-30"), fat("l13bf", "L13BF", "L13b", "600", "2026-03-05"),
         elle_kart("kl13b", "KL13B", "L13b", "900"), ktah("l13bk", "KL13B", "900", "2026-04-10")]
bek.update(cari("L13b", 0, 0, 0))
bek.update(fatura_kartta("L13BF", 0))
bek.update({"k1:hareket:l13bx:kalan": 0, "k1:hareket:l13bx:vade": "2026-03-30"})
bek.update(yok3("l13bx"))
bek.update(kart("KL13B", 90000, 90000, [30000, 30000, 30000]))

# L13c — vadeli elle borç sırayı DEĞİŞTİRMİYOR: 01.03 X 300 (vade 03.03) · 05.03 F 600 · kart 900 · 10.04 kart tahsilatı 300 ⇒ iki sırada da X → F: X Kalan 0, F açık 600 (DEĞER).
#   gecikmiş 0; bakiye 600.
adim += [ca("L13c", "Leman Vade Aynı"), borc("l13cx", "L13c", "300", "2026-03-01", "2026-03-03"), fat("l13cf", "L13CF", "L13c", "600", "2026-03-05"),
         elle_kart("kl13c", "KL13C", "L13c", "900"), ktah("l13ck", "KL13C", "300", "2026-04-10")]
bek.update(cari("L13c", 60000, 0, 60000))
bek.update(fatura_kartta("L13CF", 60000))
bek.update({"k1:hareket:l13cx:kalan": 0, "k1:hareket:l13cx:vade": "2026-03-03"})
bek.update(yok3("l13cx"))
bek.update(kart("KL13C", 90000, 30000, [30000, 0, 0]))

# L14 — Y11-9 (SUS — KULLANICIYA SORULMALI SK-25): 01.03 stok veresiye satışı S 400 · 02.03 X 300 · 15.03 kart 700 (2 × 350) · 10.04 kart tahsilatı 300. Bakiye 400, kart tutarı 700.
adim += [ca("L14", "Lütfü Stoklu"), {"id": "l14s", "islem": "stok_satis_hesap", "cari": "L14", "tutar": "400", "tarih": "2026-03-01"}, borc("l14x", "L14", "300", "2026-03-02"),
         elle_kart("kl14", "KL14", "L14", "700", taksit=2), ktah("l14k", "KL14", "300", "2026-04-10")]
sus("L14", "KL14", 70000, 40000, ["l14x"], ["SK-25", "KULLANICIYA SORULMALI"])

# L15 — borçlu Açılış (elle kayıt — Y8-3 (ii)) + fatura: 01.03 Açılış (borç) 300 · 05.03 F 600 · 15.03 kart 900 · 10.04 kart tahsilatı 300 ⇒ Açılış Kalan 0, F açık 600.
#   gecikmiş 0; bakiye 600 = açık (600 + 0).
adim += [ca("L15", "Lerna Açılış", tarih="2026-03-01", acilis="300"), fat("l15f", "L15F", "L15", "600", "2026-03-05"), elle_kart("kl15", "KL15", "L15", "900"),
         ktah("l15k", "KL15", "300", "2026-04-10")]
bek.update(cari("L15", 60000, 0, 60000))
bek.update(fatura_kartta("L15F", 60000))
bek.update({"k1:hareket:acilis:L15:kalan": 0})
bek.update(yok3("acilis:L15"))
bek.update(kart("KL15", 90000, 30000, [30000, 0, 0]))

# L16a / L16b — aynı adlı iki cari: L16a kararın örneği + 10.04 kart tahsilatı 300 (= L1: F 300, X 300); L16b yalnız fatura 600 (01.03) + 10.04 bağsız tahsilat 200, kartsız ⇒ F açık 400
#   (takvim kalemi 400 — kartsız). L16b: gecikmiş 400 (01.03 < 15.04); bakiye 400.
adim += ornek("L16a", "Aynı Lale") + [ktah("l16ak", "KL16a", "300", "2026-04-10"), ca("L16b", "Aynı Lale", "05550000016"), fat("l16bf", "L16bF", "L16b", "600", "2026-03-01"),
                                     tah("l16bt", "L16b", "200", "2026-04-10")]
bek.update(cari("L16a", 60000, 0, 60000))
bek.update(fatura_kartta("L16aF", 30000))
bek.update({"k1:hareket:l16ax:kalan": 30000})
bek.update(yok3("l16ax"))
bek.update(kart("KL16a", 90000, 30000, [30000, 0, 0]))
bek.update(cari("L16b", 40000, 40000, 40000))
bek.update(fatura_ayri("L16bF", 40000))

# L17 — yalnız elle kalemli bakiye kadar kart (bakım 10 Y10-3 — DEĞİŞMEDİ): 02.03 X 500 · 05.03 Y 400 · kart 900 · 10.04 kart tahsilatı 300 ⇒ X Kalan 200, Y 400. gecikmiş 0; bakiye 600.
adim += [ca("L17", "Lale Elle Kart"), borc("l17x", "L17", "500", "2026-03-02"), borc("l17y", "L17", "400", "2026-03-05"), elle_kart("kl17", "KL17", "L17", "900"),
         ktah("l17k", "KL17", "300", "2026-04-10")]
bek.update(cari("L17", 60000, 0, 60000))
bek.update({"k1:hareket:l17x:kalan": 20000, "k1:hareket:l17y:kalan": 40000})
bek.update(yok3("l17x"))
bek.update(yok3("l17y"))
bek.update(kart("KL17", 90000, 30000, [30000, 0, 0]))

# L18 — açık borçtan KÜÇÜK kart (S110 / S120 / S122 alanı — DEĞİŞMEDİ; fatura kartın DIŞINDA): 01.03 F 600 · 02.03 X 500 · 05.03 Y 700 · kart 900 (kartta X 500 + Y'nin 400'ü)
#   · 10.04 kart tahsilatı 300 ⇒ X Kalan 200, Y Kalan 700, F 600 (takvim 600). gecikmiş F 600 + Y 300 = 900; bakiye 1.500 = açık (600 + 200 + 700); Y takvim 300 (−41).
adim += [ca("L18", "Lale Küçük Kart"), fat("l18f", "L18F", "L18", "600", "2026-03-01"), borc("l18x", "L18", "500", "2026-03-02"), borc("l18y", "L18", "700", "2026-03-05"),
         elle_kart("kl18", "KL18", "L18", "900"), ktah("l18k", "KL18", "300", "2026-04-10")]
bek.update(cari("L18", 150000, 90000, 150000))
bek.update(fatura_ayri("L18F", 60000))
bek.update({"k1:hareket:l18x:kalan": 20000, "k1:hareket:l18y:kalan": 70000})
bek.update(yok3("l18x"))
bek.update(gorunum("l18y", 30000, "2026-03-05", -41, "L18", "Lale Küçük Kart"))
bek.update(kart("KL18", 90000, 30000, [30000, 0, 0]))

ad = "d37-c5-s126-faturali-kart"
s = {"dil": DIL, "bugun": BUGUN,
     "aciklama": "Bakım 11 (S126 = A): bakiye kadar açılan, içine fatura da giren Taksitler kartına gelen ödeme kalemleri fatura dahil kartın içine alma sırasıyla, eskiden yeniye düşürür — kararın"
                 " örneği (L1), ödeme ilk kalemi tam bitirir (L2) / aşıp ikinciye geçer (L3) / kartı kapatır (L4), iki ödeme üst üste (L5), elle borç faturadan eski (L6), iki fatura + elle (L7),"
                 " S50 payı (L8), silme (L9) ve geri yükleme (L10), ödemesiz (L11), yalnız faturalar (L12 — baş mimarın değerlendirmesine), vade ↔ belge sırası ödemeyi ayırıyor (L13 SUS — S125 = C;"
                 " L13b / L13c değer), stok veresiye satışlı kart (L14 SUS — SK-25), borçlu Açılış (L15), aynı adlı iki cari (L16a / L16b), yalnız elle kart (L17 — değişmedi), açık borçtan küçük"
                 " kart (L18 — değişmedi)",
     "dayanak": "KARARLAR.md §23 (S126 A; Y11-1 … Y11-12; SK-25), §22 (S122 A; Y10-3 / Y10-4), §21 (S120 A), §20 (Y8-4), §13 C13.4 / C13.5, K6.5",
     "elleBeklenen": bek, "elleYok": yok, "elleBelirsiz": belirsiz, "adimlar": adim + [KONTROL], "ad": ad}
bicim.yaz(os.path.join(D, ad + ".json"), s)
print("%s: %d elle denetim (%d değer + %d yok + %d belirsiz)" % (ad, len(bek) + len(yok) + len(belirsiz), len(bek), len(yok), len(belirsiz)))
