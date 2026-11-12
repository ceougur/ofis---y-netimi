#!/usr/bin/env python3
"""Bakım 12 elle senaryosu (S128 = A — bakiye kadar açılan Taksitler kartının içinde fatura / elle borç DIŞINDA kalem de varsa karta gelen ödeme kalemleri TÜRÜNE BAKILMADAN kartın içine alma
sırasıyla, eskiden yeniye düşürür). Bütün beklenen değerler bu betikte ELLE — kâhin koşulmadan, karar metninden (scratchpad/kahin-eski12-kararlar.md) ve KARARLAR.md §13 / §19 / §20 / §22 / §23 / §24'ten.
Tutarlar kuruş. Bugün 15.04.2026; kartlar 15.03'te (O = T: kart = carinin bütün açık borcu). 700'lük kart 2 taksit (01.04 / 01.05 — 350'şer). Kart tahsilatı kartın vadesi ilk gelen açık taksitine (bağ —
zamandan bağımsız, C13.4 (3)); bağsız tahsilat S2 + S50 ile kuyrukta (kartın tükettiği kalemler kuyrukta 0 — yalnız taksitler kalır, C13.4 (6)). gecikmiş = min(bakiye, Σ kuyruk kalanı {vade < bugün}) (C13.5).
NOT (6): her değer carisinde Σ (fatura açığı + elle Kalan + stok / karşılıksız kaleminin defter kalanı) = bakiye burada assert edilir (Y12-10); kâhinin `acikToplam` anahtarı KS8.1 tanımıyla stok veresiyesini
içermez (d30 Q1 emsali) — stoklu caride `acikEsitBakiye` stok kaleminin açığı 0 değilse false; karşılıksız kalemli caride iki anahtar yazılmaz (C14.3).
Adımların yeri sonra g1-sirala.py ile (G1 — her carinin kendi sırası aynen).
Kullanım: python3 -I yeni-senaryolar12.py <senaryolar klasörü>"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bicim  # noqa: E402

D = sys.argv[1]
DIL = "destekofis-cari/3"
BUGUN = "2026-04-15"
K = "k1"
KONTROL = {"id": K, "islem": "kontrol", "gecikmis": True, "gorunumToplam": True, "acikToplam": True}


def ca(ad, isim, tel=None, tarih="2026-02-01"):
    a = {"id": "c" + ad.lower(), "islem": "cari_ac", "ad": ad, "isim": isim, "tarih": tarih}
    if tel:
        a["tel"] = tel
    return a


def fat(id_, ad, cari, tutar, tarih, taksit=None):
    a = {"id": id_, "islem": "fatura", "ad": ad, "cari": cari, "tutar": tutar, "tarih": tarih}
    if taksit:
        a["taksit"] = taksit
    return a


def borc(id_, cari, tutar, tarih, vade=None):
    a = {"id": id_, "islem": "borc", "cari": cari, "tutar": tutar, "tarih": tarih}
    if vade:
        a["vade"] = vade
    return a


def stok(id_, cari, tutar, tarih):
    return {"id": id_, "islem": "stok_satis_hesap", "cari": cari, "tutar": tutar, "tarih": tarih}


def tah(id_, cari, tutar, tarih):
    return {"id": id_, "islem": "tahsilat", "cari": cari, "tutar": tutar, "tarih": tarih}


def ktah(id_, kart_ad, tutar, tarih):
    return {"id": id_, "islem": "kart_tahsilat", "kayit": kart_ad, "tutar": tutar, "tarih": tarih}


def elle_kart(id_, ad, cari, tutar, taksit=2, ilk="2026-04-01", tarih="2026-03-15", mevcut=True):
    return {"id": id_, "islem": "kart_ac", "ad": ad, "cari": cari, "tutar": tutar, "taksit": taksit, "ilkVade": ilk, "tarih": tarih, "mevcut": mevcut}


def yok3(h):
    """kuyruk kalanı 0 olan elle kalem (kartın tamamen içine aldığı): takvim / Vade Takip / projeksiyon kalemi yok (Y12-9)"""
    return {"%s:takvim:hareket:%s" % (K, h): "yok", "%s:vadeTakip:hareket:%s" % (K, h): "yok", "%s:projeksiyon:hareket:%s" % (K, h): "yok"}


def kart(no, toplam, odenen, taksitler):
    b = {"%s:kart:%s:var" % (K, no): True, "%s:kart:%s:toplam" % (K, no): toplam, "%s:kart:%s:odenen" % (K, no): odenen, "%s:kart:%s:kalan" % (K, no): toplam - odenen,
         "%s:kart:%s:mevcutBorc" % (K, no): True}
    assert sum(taksitler) == odenen
    for i, v in enumerate(taksitler):
        b["%s:kart:%s:taksit%d:odenen" % (K, no, i + 1)] = v
    return b


def cari(ad, bakiye, gecikmis=None, acik=None, defter=None):
    """acik: kâhinin KS8.1 `acikToplam`'ı (Σ fatura açığı + Σ elle Kalan); defter: NOT (6) — bütün kalemlerin defter kalanı toplamı (stok / karşılıksız dahil) = bakiye (assert)"""
    if defter is not None:
        assert defter == bakiye, (ad, defter, bakiye)
    b = {"%s:cari:%s:bakiye" % (K, ad): bakiye}
    if gecikmis is not None:
        b["%s:cari:%s:gecikmis" % (K, ad)] = gecikmis
    if acik is not None:
        b["%s:cari:%s:acikToplam" % (K, ad)] = acik
        b["%s:cari:%s:acikEsitBakiye" % (K, ad)] = acik == bakiye
    return b


def fatura_kartta(ad, acik):
    """kartın tamamen içine aldığı satış faturası: açık = defter kalanı (Y12-2); takvim kalemi DEĞİL (Y11-10 / Y12-9)"""
    return {"%s:fatura:%s:acik" % (K, ad): acik, "%s:takvim:fatura:%s" % (K, ad): "yok"}


adim, bek, yok, belirsiz = [], {}, [], []


def ornek(c, isim, tel=None):
    """kararın örneği AYNEN: 01.03 stok veresiye satışı S 400 · 02.03 elle borç X 300 (vadesiz) · 15.03 kart 700 (2 × 350) — açık borç 700 = kart (O = T) ⇒ kartta S 400 + X 300 (M1e, S2 sırası S → X)."""
    lo = c.lower()
    return [ca(c, isim, tel), stok(lo + "s", c, "400", "2026-03-01"), borc(lo + "x", c, "300", "2026-03-02"), elle_kart("k" + lo, "K" + c, c, "700")]


def sus(c, kart_no, toplam, bakiye, kalemler, parcalar, fatura_ad=None):
    """kâhinin SUSTUĞU cari (C13.4 (11) düzeni): yalnız bakiye ve kart tutarı yazılır; `belirsiz` kaydında nedenin parçaları"""
    bek.update(cari(c, bakiye))
    bek.update({"%s:kart:%s:var" % (K, kart_no): True, "%s:kart:%s:toplam" % (K, kart_no): toplam})
    yok.extend(["%s:cari:%s:gecikmis" % (K, c), "%s:kart:%s:kalan" % (K, kart_no)] + ["%s:hareket:%s:kalan" % (K, h) for h in kalemler] + ["%s:takvim:hareket:%s" % (K, kalemler[0])])
    if fatura_ad:
        yok.append("%s:fatura:%s:acik" % (K, fatura_ad))
    belirsiz.append(["cari %s tanımsız" % c] + parcalar)


# M1 — kararın örneği AYNEN: + 10.04 kart tahsilatı 300 (taksit 1). P = 300 ⇒ S'ye (içine alma sırasında ilk): S açığı 0 + 400 − 300 = 100 (kâhinde anahtar yok); X Kalan 0 + 300 − 0 = 300 (kararın sonucu).
#   bakiye 700 − 300 = 400; kart kalanı 400 (kararın parantezi). gecikmiş: taksit 1'in kalanı 350 − 300 = 50 (01.04 < 15.04) → 50. acikToplam (KS8.1) = X 300 ≠ 400 → false; NOT (6): 100 + 300 = 400.
#   (S128 B: X 0, S 400 — X Kalan 0.)
adim += ornek("M1", "Mert Örnek") + [ktah("m1k", "KM1", "300", "2026-04-10")]
bek.update(cari("M1", 40000, 5000, 30000, defter=10000 + 30000))
bek.update({"k1:hareket:m1x:kalan": 30000})
bek.update(yok3("m1x"))
bek.update(kart("KM1", 70000, 30000, [30000, 0]))

# M2 — ödeme ilk kalemi (S) TAM bitirir: kart tahsilatı 400 (taksit 1 350 + taksit 2'nin 50'si) ⇒ S açığı 0, X Kalan 300. gecikmiş 0; bakiye 300 = açık (0 + 300) → true.
adim += ornek("M2", "Mine Tam Biter") + [ktah("m2k", "KM2", "400", "2026-04-10")]
bek.update(cari("M2", 30000, 0, 30000, defter=0 + 30000))
bek.update({"k1:hareket:m2x:kalan": 30000})
bek.update(yok3("m2x"))
bek.update(kart("KM2", 70000, 40000, [35000, 5000]))

# M3 — ödeme S'yi aşıp X'e geçer: kart tahsilatı 500 (350 + 150) ⇒ S 0, X Kalan 300 − 100 = 200. gecikmiş 0; bakiye 200 = açık.
adim += ornek("M3", "Murat Aşar") + [ktah("m3k", "KM3", "500", "2026-04-10")]
bek.update(cari("M3", 20000, 0, 20000, defter=0 + 20000))
bek.update({"k1:hareket:m3x:kalan": 20000})
bek.update(yok3("m3x"))
bek.update(kart("KM3", 70000, 50000, [35000, 15000]))

# M4 — kartı tamamen kapatır: kart tahsilatı 700 ⇒ S 0, X 0. gecikmiş 0; bakiye 0 = açık.
adim += ornek("M4", "Meral Kapatır") + [ktah("m4k", "KM4", "700", "2026-04-10")]
bek.update(cari("M4", 0, 0, 0, defter=0))
bek.update({"k1:hareket:m4x:kalan": 0})
bek.update(yok3("m4x"))
bek.update(kart("KM4", 70000, 70000, [35000, 35000]))

# M5 — iki ödeme üst üste (Y12-5: birikimli — toplam 500 tek ödeme gibi): 05.04 kart tahsilatı 200 + 10.04 kart tahsilatı 300 ⇒ kart [350, 150]; S 0, X 200. gecikmiş 0; bakiye 200.
#   (İkinci ödemede sıra baştan başlasaydı X 300.)
adim += ornek("M5", "Melek İki Ödeme") + [ktah("m5k1", "KM5", "200", "2026-04-05"), ktah("m5k2", "KM5", "300", "2026-04-10")]
bek.update(cari("M5", 20000, 0, 20000, defter=0 + 20000))
bek.update({"k1:hareket:m5x:kalan": 20000})
bek.update(yok3("m5x"))
bek.update(kart("KM5", 70000, 50000, [35000, 15000]))

# M6 — elle borç stok satışından ESKİ (sıra tersine — tarih belirliyor, tür değil): 01.03 X 300 · 02.03 S 400 · 15.03 kart 700 (kartta X 300 + S 400) · 10.04 kart tahsilatı 300 ⇒ X Kalan 0, S açığı 400.
#   gecikmiş 50; bakiye 400; acikToplam 0 → false; NOT (6): 0 + 400 = 400.
adim += [ca("M6", "Mehmet Elle Eski"), borc("m6x", "M6", "300", "2026-03-01"), stok("m6s", "M6", "400", "2026-03-02"), elle_kart("km6", "KM6", "M6", "700"),
         ktah("m6k", "KM6", "300", "2026-04-10")]
bek.update(cari("M6", 40000, 5000, 0, defter=0 + 40000))
bek.update({"k1:hareket:m6x:kalan": 0})
bek.update(yok3("m6x"))
bek.update(kart("KM6", 70000, 30000, [30000, 0]))

# M7 — stok satışı + fatura + elle borç üçü birlikte: 01.03 S 400 · 02.03 F 600 · 03.03 X 300 · 15.03 kart 1.300 (2 × 650) · 10.04 kart tahsilatı 700 (taksit 1 650 + taksit 2'nin 50'si)
#   ⇒ sıra S → F → X: S 400, F 300, X 0 ⇒ S açığı 0, F açık 300, X Kalan 300. gecikmiş 0; bakiye 1.300 − 700 = 600 = açık (300 + 300) → true.
#   (S128 B — önce fatura ve elle: F 600, X 100 ⇒ F 0, X 200, S 400.)
adim += [ca("M7", "Mualla Üçlü"), stok("m7s", "M7", "400", "2026-03-01"), fat("m7f", "M7F", "M7", "600", "2026-03-02"), borc("m7x", "M7", "300", "2026-03-03"),
         elle_kart("km7", "KM7", "M7", "1300"), ktah("m7k", "KM7", "700", "2026-04-10")]
bek.update(cari("M7", 60000, 0, 60000, defter=0 + 30000 + 30000))
bek.update(fatura_kartta("M7F", 30000))
bek.update({"k1:hareket:m7x:kalan": 30000})
bek.update(yok3("m7x"))
bek.update(kart("KM7", 130000, 70000, [65000, 5000]))

# M8 — S50 yolu (Y12-4): kararın örneği + 10.04 bağsız tahsilat 500 (kuyrukta yalnız taksitler: taksit 1 350 → taksit 2'nin 150'si). P = 500 ⇒ S 0, X Kalan 200.
#   gecikmiş 0; bakiye 200 = açık.
adim += ornek("M8", "Mahir Bağsız") + [tah("m8t", "M8", "500", "2026-04-10")]
bek.update(cari("M8", 20000, 0, 20000, defter=0 + 20000))
bek.update({"k1:hareket:m8x:kalan": 20000})
bek.update(yok3("m8x"))
bek.update(kart("KM8", 70000, 50000, [35000, 15000]))

# M9 — silme (Y12-5): kararın örneği + 10.04 kart tahsilatı 300 (taksit 1) · 12.04 bağsız tahsilat 300 · 12.04 tahsilatı SİLİNİR ⇒ P 300: X 300 (M1 ile aynı). gecikmiş 50; bakiye 400.
adim += ornek("M9", "Mazlum Siler") + [ktah("m9k", "KM9", "300", "2026-04-10"), tah("m9t", "M9", "300", "2026-04-12"), {"id": "m9s", "islem": "hareket_sil", "hareket": "m9t", "cari": "M9"}]
bek.update(cari("M9", 40000, 5000, 30000, defter=10000 + 30000))
bek.update({"k1:hareket:m9x:kalan": 30000})
bek.update(yok3("m9x"))
bek.update(kart("KM9", 70000, 30000, [30000, 0]))

# M10 — silme + geri yükleme: M9 ile aynı + silinen tahsilat geri yüklenir (kendi tarihinde 12.04 — S50: taksit 1'in kalan 50'si + taksit 2'nin 250'si) ⇒ P 600: S 400, X 200 ⇒ X Kalan 100.
#   gecikmiş 0; bakiye 100 = açık.
adim += ornek("M10", "Mazlum Geri Yükler") + [ktah("m10k", "KM10", "300", "2026-04-10"), tah("m10t", "M10", "300", "2026-04-12"),
                                             {"id": "m10s", "islem": "hareket_sil", "hareket": "m10t", "cari": "M10"},
                                             {"id": "m10g", "islem": "hareket_geri_yukle", "hareket": "m10t", "cari": "M10"}]
bek.update(cari("M10", 10000, 0, 10000, defter=0 + 10000))
bek.update({"k1:hareket:m10x:kalan": 10000})
bek.update(yok3("m10x"))
bek.update(kart("KM10", 70000, 60000, [35000, 25000]))

# M11 — P = 0 (Y12-6): kararın kartı, ödeme yok ⇒ X Kalan 300 (S açığı 400). gecikmiş = taksit 1 350 (01.04 < 15.04); bakiye 700; acikToplam 300 → false.
adim += ornek("M11", "Melahat Ödemesiz")
bek.update(cari("M11", 70000, 35000, 30000, defter=40000 + 30000))
bek.update({"k1:hareket:m11x:kalan": 30000})
bek.update(yok3("m11x"))
bek.update(kart("KM11", 70000, 0, [0, 0]))

# M12 — karşılıksız kalemi (Y12-3 (ii)): 20.02 carisiz çek E12 400 alındı · 01.03 karşılıksız, cari M12 seçildi (M12'nin borç kalemi 400, belge günü = vade = 01.03 — C14.3) · 02.03 X 300 · 15.03 kart 700
#   · 10.04 kart tahsilatı 300 ⇒ sıra karşılıksız → X: karşılıksız 300 ⇒ X Kalan 300. bakiye 400 + 300 − 300 = 400; gecikmiş 50. acikToplam / acikEsitBakiye YAZILMAZ (C14.3 aynen).
# carisiz evrak adımı carisi çözülemediği için G1 sıralamasında SINIRDIR — senaryonun EN BAŞINA konur (seriden numara alan faturalar tek kesimde tarih sırasıyla kalsın)
adim.insert(0, {"id": "e12", "islem": "evrak", "ad": "E12", "cari": None, "tur": "cek", "tutar": "400", "tarih": "2026-02-20"})
adim += [ca("M12", "Mesut Karşılıksız"),
         {"id": "x12", "islem": "karsiliksiz", "evrak": "E12", "cari": "M12", "tarih": "2026-03-01"}, borc("m12x", "M12", "300", "2026-03-02"),
         elle_kart("km12", "KM12", "M12", "700"), ktah("m12k", "KM12", "300", "2026-04-10")]
bek.update(cari("M12", 40000, 5000, defter=10000 + 30000))
yok.extend(["k1:cari:M12:acikToplam", "k1:cari:M12:acikEsitBakiye"])
bek.update({"k1:hareket:m12x:kalan": 30000})
bek.update(yok3("m12x"))
bek.update(kart("KM12", 70000, 30000, [30000, 0]))

# M13 — içinde fatura / elle OLMAYAN kart (Y12-7): 01.03 S1 400 · 02.03 S2 300 (iki stok veresiye satışı) · 15.03 kart 700 · 10.04 kart tahsilatı 300 ⇒ yazılan hiçbir değer dağılıma bağlı değil:
#   bakiye 400, gecikmiş 50, kart 700 / 300; acikToplam 0 → false; NOT (6): S1 100 + S2 300 = 400.
adim += [ca("M13", "Metin Stoklar"), stok("m13s1", "M13", "400", "2026-03-01"), stok("m13s2", "M13", "300", "2026-03-02"), elle_kart("km13", "KM13", "M13", "700"),
         ktah("m13k", "KM13", "300", "2026-04-10")]
bek.update(cari("M13", 40000, 5000, 0, defter=10000 + 30000))
bek.update(kart("KM13", 70000, 30000, [30000, 0]))

# M14 — başka taksit kartının taksiti (Y12-3 (iii) — SUS: SK-18 + SK-26): 10.02 Yeni Borç kartı KM14A 400 (2 × 200: 01.03 / 01.04) · 02.03 X 300 · 15.03 kart KM14 700 (kartta A#1 200 + X 300 + A#2 200)
#   · 10.04 bağsız tahsilat 300. Kartın kabulü SK-18 (bakiye 700 − taksitlendirilmiş 400 = 300 < 700 ↔ kalem okuması kabul) → iki dünyada farklı çıkanlar yazılmaz; kart dünyasında cari SK-26 ile susar.
#   Yazılan: bakiye 400 (iki dünyada aynı: 400 + 300 − 300), KM14A'nın var / tutar / türü (iki dünyada aynı).
adim += [ca("M14", "Muzaffer İki Kart"), elle_kart("km14a", "KM14A", "M14", "400", ilk="2026-03-01", tarih="2026-02-10", mevcut=False), borc("m14x", "M14", "300", "2026-03-02"),
         elle_kart("km14", "KM14", "M14", "700"), tah("m14t", "M14", "300", "2026-04-10")]
bek.update(cari("M14", 40000))
bek.update({"k1:kart:KM14A:var": True, "k1:kart:KM14A:toplam": 40000, "k1:kart:KM14A:mevcutBorc": False})
yok.extend(["k1:cari:M14:gecikmis", "k1:kart:KM14:var", "k1:kart:KM14:kalan", "k1:kart:KM14A:odenen", "k1:hareket:m14x:kalan", "k1:takvim:hareket:m14x"])
belirsiz.append(["cari M14 tanımsız", "SK-26"])
belirsiz.append(["cari M14", "KM14", "SK-18"])

# M15 — taksitli faturanın taksiti (Y12-3 (iv) — SUS: SK-18 + SK-26): 01.03 taksitli fatura M15T 400 (2 × 200: 01.03 / 01.04) · 02.03 X 300 · 15.03 kart 700 · 10.04 bağsız tahsilat 300.
#   Yazılan: bakiye 400.
adim += [ca("M15", "Mukaddes Taksitli"), fat("m15f", "M15T", "M15", "400", "2026-03-01", {"sayi": 2, "ilkVade": "2026-03-01"}), borc("m15x", "M15", "300", "2026-03-02"),
         elle_kart("km15", "KM15", "M15", "700"), tah("m15t", "M15", "300", "2026-04-10")]
bek.update(cari("M15", 40000))
yok.extend(["k1:cari:M15:gecikmis", "k1:kart:KM15:var", "k1:kart:KM15:kalan", "k1:fatura:M15T:acik", "k1:hareket:m15x:kalan", "k1:takvim:hareket:m15x"])
belirsiz.append(["cari M15 tanımsız", "SK-26"])
belirsiz.append(["cari M15", "KM15", "SK-18"])

# M16 — Y12-8 (SUS — BİLİNEN SINIR S125 = C): 01.03 X 300 (vade 30.03) · 05.03 S 400 · 15.03 kart 700 · 10.04 kart tahsilatı 300 ⇒ vade sırası S → X (X 300) ↔ belge sırası X → S (X 0) — ayrışıyor.
#   Bakiye 400, kart tutarı 700.
adim += [ca("M16", "Meltem Vade Ters"), borc("m16x", "M16", "300", "2026-03-01", "2026-03-30"), stok("m16s", "M16", "400", "2026-03-05"), elle_kart("km16", "KM16", "M16", "700"),
         ktah("m16k", "KM16", "300", "2026-04-10")]
sus("M16", "KM16", 70000, 40000, ["m16x"], ["S125 = C", "SK-23"])

# M16b — M16 düzeni, kart tahsilatı 700 (kart tamamen ödenir) ⇒ iki sırada da X 0, S 0 (aynı pay → DEĞER). gecikmiş 0; bakiye 0 = açık.
adim += [ca("M16b", "Meltem Vade Tam"), borc("m16bx", "M16b", "300", "2026-03-01", "2026-03-30"), stok("m16bs", "M16b", "400", "2026-03-05"),
         elle_kart("km16b", "KM16B", "M16b", "700"), ktah("m16bk", "KM16B", "700", "2026-04-10")]
bek.update(cari("M16b", 0, 0, 0, defter=0))
bek.update({"k1:hareket:m16bx:kalan": 0, "k1:hareket:m16bx:vade": "2026-03-30"})
bek.update(yok3("m16bx"))
bek.update(kart("KM16B", 70000, 70000, [35000, 35000]))

# M17a / M17b — aynı adlı iki cari: M17a kararın örneği + 10.04 kart tahsilatı 300 (= M1: X 300, gecikmiş 50); M17b yalnız stok veresiye satışı 400 (01.03) + 10.04 bağsız tahsilat 100, kartsız
#   ⇒ bakiye 300; gecikmiş 300 (stok kalemi 01.03 < 15.04, kuyruk kalanı 300); acikToplam 0 → false.
adim += ornek("M17a", "Aynı Mert") + [ktah("m17ak", "KM17a", "300", "2026-04-10"), ca("M17b", "Aynı Mert", "05550000017"), stok("m17bs", "M17b", "400", "2026-03-01"),
                                     tah("m17bt", "M17b", "100", "2026-04-10")]
bek.update(cari("M17a", 40000, 5000, 30000, defter=10000 + 30000))
bek.update({"k1:hareket:m17ax:kalan": 30000})
bek.update(yok3("m17ax"))
bek.update(kart("KM17a", 70000, 30000, [30000, 0]))
bek.update(cari("M17b", 30000, 30000, 0, defter=30000))

# M18 — yalnız fatura + elle kart (bakım 11 S126 — DEĞİŞMEDİ): 01.03 F 600 · 02.03 X 300 · kart 900 (3 × 300) · 10.04 kart tahsilatı 300 ⇒ F açık 300, X Kalan 300. gecikmiş 0; bakiye 600 = açık.
adim += [ca("M18", "Mürvet Faturalı"), fat("m18f", "M18F", "M18", "600", "2026-03-01"), borc("m18x", "M18", "300", "2026-03-02"), elle_kart("km18", "KM18", "M18", "900", taksit=3),
         ktah("m18k", "KM18", "300", "2026-04-10")]
bek.update(cari("M18", 60000, 0, 60000, defter=30000 + 30000))
bek.update(fatura_kartta("M18F", 30000))
bek.update({"k1:hareket:m18x:kalan": 30000})
bek.update(yok3("m18x"))
bek.update(kart("KM18", 90000, 30000, [30000, 0, 0]))

# M19 — açık borçtan KÜÇÜK kart (S120 / S122 alanı — DEĞİŞMEDİ; stok satışı kartın DIŞINDA): 01.03 S 400 · 02.03 X 500 · 05.03 Y 300 · 15.03 kart 800 (2 × 400; yalnız elle borçlar eskiden yeniye:
#   X 500 + Y 300) · 10.04 kart tahsilatı 300 (taksit 1) ⇒ X Kalan 200, Y Kalan 300; S kuyrukta 400. gecikmiş S 400 + taksit 1'in 100'ü = 500; bakiye 900; acikToplam 500 → false.
adim += [ca("M19", "Muhsin Küçük Kart"), stok("m19s", "M19", "400", "2026-03-01"), borc("m19x", "M19", "500", "2026-03-02"), borc("m19y", "M19", "300", "2026-03-05"),
         elle_kart("km19", "KM19", "M19", "800"), ktah("m19k", "KM19", "300", "2026-04-10")]
bek.update(cari("M19", 90000, 50000, 50000, defter=40000 + 20000 + 30000))
bek.update({"k1:hareket:m19x:kalan": 20000, "k1:hareket:m19y:kalan": 30000})
bek.update(yok3("m19x"))
bek.update(yok3("m19y"))
bek.update(kart("KM19", 80000, 30000, [30000, 0]))

ad = "d38-c5-s128-ozge-kalemli-kart"
s = {"dil": DIL, "bugun": BUGUN,
     "aciklama": "Bakım 12 (S128 = A): bakiye kadar açılan Taksitler kartının içinde fatura / elle borç dışında kalem de varsa karta gelen ödeme kalemleri türüne bakılmadan içine alma sırasıyla, eskiden"
                 " yeniye düşürür — kararın örneği (M1), ödeme ilk kalemi tam bitirir (M2) / aşıp ikinciye geçer (M3) / kartı kapatır (M4), iki ödeme üst üste (M5), elle borç stok satışından eski"
                 " (M6), stok + fatura + elle (M7), S50 payı (M8), silme (M9) ve geri yükleme (M10), ödemesiz (M11), karşılıksız kalemi (M12), yalnız stok satışları (M13), başka kartın taksiti (M14 SUS"
                 " — SK-18 + SK-26), taksitli faturanın taksiti (M15 SUS — SK-18 + SK-26), vade ↔ belge sırası ödemeyi ayırıyor (M16 SUS — S125 = C; M16b değer), aynı adlı iki cari (M17a / M17b),"
                 " yalnız fatura + elle kart (M18 — değişmedi), açık borçtan küçük kart (M19 — değişmedi)",
     "dayanak": "KARARLAR.md §24 (S128 A; Y12-1 … Y12-12; SK-26), §23 (S126 A), §22 (S122 A; Y10-2 / Y10-4 / Y10-5), §21 (S120 A), §20 (Y8-4), §19 (Y7-3, SK-18), §13 C13.4 / C13.5, C14.3, K6.5",
     "elleBeklenen": bek, "elleYok": yok, "elleBelirsiz": belirsiz, "adimlar": adim + [KONTROL], "ad": ad}
bicim.yaz(os.path.join(D, ad + ".json"), s)
print("%s: %d elle denetim (%d değer + %d yok + %d belirsiz)" % (ad, len(bek) + len(yok) + len(belirsiz), len(bek), len(yok), len(belirsiz)))
