#!/usr/bin/env python3
"""Bakım 10 elle senaryosu (S122 = A — birden çok elle borcu içine alan karta gelen ödeme elle borçların Kalan'ını kartın içine alma sırasıyla, eskiden yeniye düşürür; S123 / S124 / S125 = C
BİLİNEN SINIR). Bütün beklenen değerler bu betikte ELLE — kâhin koşulmadan, karar metninden (scratchpad/kahin-eski10-kararlar.md) ve KARARLAR.md §13 / §20 / §21 / §22'den. Tutarlar kuruş.
Bugün 15.04.2026; kartlar 15.03'te, taksitleri 01.04 / 01.05 / 01.06 (2 taksitlide 01.04 / 01.05). Adımların yeri sonra g1-sirala.py ile (G1 — her carinin kendi sırası aynen).
Kullanım: python3 -I yeni-senaryolar10.py <senaryolar klasörü>"""
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
    """kartın içine almadığı (ya da kısmen aldığı) elle kalem: takvim / Vade Takip / projeksiyon tutarı = kuyruk kalanı (C13.4 (7); §20 Y8-4; §22 Y10-1 'takvim değişmez')"""
    v = {"amount": tutar, "date": gun, "direction": "in"}
    return {"%s:takvim:hareket:%s" % (K, h): kalem(tutar, gun, gunler, cari, kisi), "%s:vadeTakip:hareket:%s" % (K, h): v, "%s:projeksiyon:hareket:%s" % (K, h): dict(v)}


def yok3(h):
    """kuyruk kalanı 0 olan elle kalem (kartın tamamen içine aldığı ya da tahsilatla kapanan): takvim / Vade Takip / projeksiyon kalemi yok"""
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


def fatura(ad, acik):
    return {"%s:fatura:%s:acik" % (K, ad): acik, "%s:takvim:fatura:%s" % (K, ad): {"amount": acik, "direction": "in"} if acik > 0 else "yok"}


adim, bek, yok, belirsiz = [], {}, [], []


def ornek(c, isim, tel=None):
    """kararın örneği AYNEN: 01.03 F 600 (en eski) · 02.03 Borç X 500 · 05.03 Borç Y 700 (vadesiz) · 15.03 kart 900 (3 × 300) ⇒ kartta X 500 + Y'nin 400'ü; ayrı F 600 + Y 300."""
    lo = c.lower()
    return [ca(c, isim, tel), fat(lo + "f", c + "F", c, "600", "2026-03-01"), borc(lo + "x", c, "500", "2026-03-02"), borc(lo + "y", c, "700", "2026-03-05"),
            elle_kart("k" + lo, "K" + c, c, "900")]


def sus(c, kart_no, toplam, bakiye, kalemler, parcalar, fatura_ad=None):
    """kâhinin SUSTUĞU cari (C13.4 (11) düzeni): yalnız bakiye ve kart tutarı yazılır; `belirsiz` kaydında nedenin parçaları"""
    bek.update(cari(c, bakiye))
    bek.update({"%s:kart:%s:var" % (K, kart_no): True, "%s:kart:%s:toplam" % (K, kart_no): toplam})
    yok.extend(["%s:cari:%s:gecikmis" % (K, c), "%s:kart:%s:kalan" % (K, kart_no)] + ["%s:hareket:%s:kalan" % (K, h) for h in kalemler] + ["%s:takvim:hareket:%s" % (K, kalemler[0])])
    if fatura_ad:
        yok.append("%s:fatura:%s:acik" % (K, fatura_ad))
    belirsiz.append(["cari %s tanımsız" % c] + parcalar)


# J1 — kararın örneği + 10.04 kart tahsilatı 500 (taksit 1 300 + taksit 2'nin 200'ü): ödeme X'in karttaki 500'ünü TAM bitirir (Y10-1). X Kalan 0 + 500 − 500 = 0; Y Kalan 300 + 400 − 0 = 700.
#   gecikmiş = F 600 + Y 300 (vadesiz 05.03) + taksit 1 0 = 900; bakiye 1.800 − 500 = 1.300 = açık (F 600 + X 0 + Y 700).
adim += ornek("J1", "Jale Tam Biter") + [ktah("j1k", "KJ1", "500", "2026-04-10")]
bek.update(cari("J1", 130000, 90000, 130000))
bek.update(fatura("J1F", 60000))
bek.update({"k1:hareket:j1x:kalan": 0, "k1:hareket:j1y:kalan": 70000})
bek.update(yok3("j1x"))
bek.update(gorunum("j1y", 30000, "2026-03-05", -41, "J1", "Jale Tam Biter"))
bek.update(kart("KJ1", 90000, 50000, [30000, 20000, 0]))

# J2 — kararın örneği + 10.04 kart tahsilatı 700 (300 + 300 + 100): ödeme X'i aşıp Y'ye geçer. X Kalan 0; Y Kalan 300 + 400 − 200 = 500. gecikmiş 900; bakiye 1.100 = açık (600 + 0 + 500).
adim += ornek("J2", "Jülide Aşar") + [ktah("j2k", "KJ2", "700", "2026-04-10")]
bek.update(cari("J2", 110000, 90000, 110000))
bek.update(fatura("J2F", 60000))
bek.update({"k1:hareket:j2x:kalan": 0, "k1:hareket:j2y:kalan": 50000})
bek.update(yok3("j2x"))
bek.update(gorunum("j2y", 30000, "2026-03-05", -41, "J2", "Jülide Aşar"))
bek.update(kart("KJ2", 90000, 70000, [30000, 30000, 10000]))

# J3 — kararın örneği + 10.04 kart tahsilatı 900: kart tamamen kapanır. X Kalan 0; Y Kalan 300 (yalnız kartın dışında kalan açık kısmı). gecikmiş 900; bakiye 900 = açık (600 + 0 + 300).
adim += ornek("J3", "Jilet Kapatır") + [ktah("j3k", "KJ3", "900", "2026-04-10")]
bek.update(cari("J3", 90000, 90000, 90000))
bek.update(fatura("J3F", 60000))
bek.update({"k1:hareket:j3x:kalan": 0, "k1:hareket:j3y:kalan": 30000})
bek.update(yok3("j3x"))
bek.update(gorunum("j3y", 30000, "2026-03-05", -41, "J3", "Jilet Kapatır"))
bek.update(kart("KJ3", 90000, 90000, [30000, 30000, 30000]))

# J4 — iki ayrı ödeme üst üste: 05.04 kart tahsilatı 300 + 10.04 kart tahsilatı 300 (Y10-5: birikimli — toplam 600 tek ödeme gibi). X Kalan 0 (500 − 500); Y Kalan 300 + 400 − 100 = 600.
#   gecikmiş 900; bakiye 1.200 = açık (600 + 0 + 600). (İkinci ödemede sıra baştan başlasaydı X Kalan −100.)
adim += ornek("J4", "Jerfi İki Ödeme") + [ktah("j4k1", "KJ4", "300", "2026-04-05"), ktah("j4k2", "KJ4", "300", "2026-04-10")]
bek.update(cari("J4", 120000, 90000, 120000))
bek.update(fatura("J4F", 60000))
bek.update({"k1:hareket:j4x:kalan": 0, "k1:hareket:j4y:kalan": 60000})
bek.update(yok3("j4x"))
bek.update(gorunum("j4y", 30000, "2026-03-05", -41, "J4", "Jerfi İki Ödeme"))
bek.update(kart("KJ4", 90000, 60000, [30000, 30000, 0]))

# J5 — üç elle borç içeren kart: 01.03 F 600 · 02.03 X 300 · 03.03 Y 300 · 05.03 Z 500 · 15.03 kart 900 ⇒ kartta X 300 + Y 300 + Z'nin 300'ü (S120 A; eşit elle yok, E 1.100 ≥ 900);
#   10.04 kart tahsilatı 700 ⇒ X 300, Y 300, Z 100. X Kalan 0, Y Kalan 0, Z Kalan 200 + 300 − 100 = 400. gecikmiş F 600 + Z 200 = 800; bakiye 1.700 − 700 = 1.000 = açık (600 + 0 + 0 + 400).
adim += [ca("J5", "Jüri Üç Borç"), fat("j5f", "J5F", "J5", "600", "2026-03-01"), borc("j5x", "J5", "300", "2026-03-02"), borc("j5y", "J5", "300", "2026-03-03"),
         borc("j5z", "J5", "500", "2026-03-05"), elle_kart("kj5", "KJ5", "J5", "900"), ktah("j5k", "KJ5", "700", "2026-04-10")]
bek.update(cari("J5", 100000, 80000, 100000))
bek.update(fatura("J5F", 60000))
bek.update({"k1:hareket:j5x:kalan": 0, "k1:hareket:j5y:kalan": 0, "k1:hareket:j5z:kalan": 40000})
bek.update(yok3("j5x"))
bek.update(yok3("j5y"))
bek.update(gorunum("j5z", 20000, "2026-03-05", -41, "J5", "Jüri Üç Borç"))
bek.update(kart("KJ5", 90000, 70000, [30000, 30000, 10000]))

# J6 — kısmen ödenmiş elle borcu içeren kart: 01.03 X 800 · 05.03 tahsilat 300 (X → 500) · 06.03 F 600 · 07.03 Y 700 · 15.03 kart 900 ⇒ kartta X'in açık 500'ü + Y'nin 400'ü;
#   10.04 kart tahsilatı 300 ⇒ X'e. X Kalan 0 + 500 − 300 = 200 (800 − 300 − 300); Y Kalan 700. gecikmiş F 600 + Y 300 = 900; bakiye 2.100 − 600 = 1.500 = açık (600 + 200 + 700).
adim += [ca("J6", "Jale Kısmi"), borc("j6x", "J6", "800", "2026-03-01"), tah("j6t", "J6", "300", "2026-03-05"), fat("j6f", "J6F", "J6", "600", "2026-03-06"),
         borc("j6y", "J6", "700", "2026-03-07"), elle_kart("kj6", "KJ6", "J6", "900"), ktah("j6k", "KJ6", "300", "2026-04-10")]
bek.update(cari("J6", 150000, 90000, 150000))
bek.update(fatura("J6F", 60000))
bek.update({"k1:hareket:j6x:kalan": 20000, "k1:hareket:j6y:kalan": 70000})
bek.update(yok3("j6x"))
bek.update(gorunum("j6y", 30000, "2026-03-07", -39, "J6", "Jale Kısmi"))
bek.update(kart("KJ6", 90000, 30000, [30000, 0, 0]))

# J7 — S50 yolu (Y10-2), ödeme X'i aşıp Y'ye geçer: kararın örneği + 10.04 bağsız tahsilat 1.500 (S2: F 600 → Y 300 → taksit 1 300 → taksit 2 300); kartın ödeneni 600.
#   X Kalan 0; Y Kalan 0 + 400 − 100 = 300; F 0. gecikmiş 0; bakiye 300 = açık (0 + 0 + 300).
adim += ornek("J7", "Jüstin Bağsız") + [tah("j7t", "J7", "1500", "2026-04-10")]
bek.update(cari("J7", 30000, 0, 30000))
bek.update(fatura("J7F", 0))
bek.update({"k1:hareket:j7x:kalan": 0, "k1:hareket:j7y:kalan": 30000})
bek.update(yok3("j7x"))
bek.update(yok3("j7y"))
bek.update(kart("KJ7", 90000, 60000, [30000, 30000, 0]))

# J8 — silme (Y10-5, NOT (3)): kararın örneği + 05.04 bağsız tahsilat 900 (F 600 + Y 300) · 10.04 kart tahsilatı 300 (taksit 1) · 12.04 bağsız tahsilat 300 (taksit 2 — S50) · 12.04
#   tahsilatı SİLİNİR ⇒ hiç yapılmamış gibi: kartın ödeneni 300. X Kalan 200, Y Kalan 0 + 400 = 400; F 0. gecikmiş 0; bakiye 1.800 − 1.200 = 600 = açık (0 + 200 + 400).
adim += ornek("J8", "Jön Siler") + [tah("j8t1", "J8", "900", "2026-04-05"), ktah("j8k", "KJ8", "300", "2026-04-10"), tah("j8t2", "J8", "300", "2026-04-12"),
                                    {"id": "j8s", "islem": "hareket_sil", "hareket": "j8t2", "cari": "J8"}]
bek.update(cari("J8", 60000, 0, 60000))
bek.update(fatura("J8F", 0))
bek.update({"k1:hareket:j8x:kalan": 20000, "k1:hareket:j8y:kalan": 40000})
bek.update(yok3("j8x"))
bek.update(yok3("j8y"))
bek.update(kart("KJ8", 90000, 30000, [30000, 0, 0]))

# J9 — silme + geri yükleme: J8 ile aynı + silinen tahsilat Silinenler'den geri yüklenir (kendi tarihinde, 12.04 — taksit 2) ⇒ kartın ödeneni 600. X Kalan 0, Y Kalan 400 − 100 = 300; F 0.
#   gecikmiş 0; bakiye 1.800 − 1.500 = 300 = açık (0 + 0 + 300).
adim += ornek("J9", "Jön Geri Yükler") + [tah("j9t1", "J9", "900", "2026-04-05"), ktah("j9k", "KJ9", "300", "2026-04-10"), tah("j9t2", "J9", "300", "2026-04-12"),
                                          {"id": "j9s", "islem": "hareket_sil", "hareket": "j9t2", "cari": "J9"}, {"id": "j9g", "islem": "hareket_geri_yukle", "hareket": "j9t2", "cari": "J9"}]
bek.update(cari("J9", 30000, 0, 30000))
bek.update(fatura("J9F", 0))
bek.update({"k1:hareket:j9x:kalan": 0, "k1:hareket:j9y:kalan": 30000})
bek.update(yok3("j9x"))
bek.update(yok3("j9y"))
bek.update(kart("KJ9", 90000, 60000, [30000, 30000, 0]))

# J10 — tek kalem içeren kart (Y10-7: C13.4 (7) / bakım 9 AYNEN — S120'nin 2. örneği + ödeme): 01.03 F 600 · 02.03 Borç 900 · 15.03 kart 600 (2 × 300) ⇒ Borç'un 600'ü kartta;
#   10.04 kart tahsilatı 300. Borç Kalan 300 + 600 − 300 = 600. gecikmiş F 600 + Borç 300 = 900; bakiye 1.200 = açık (600 + 600).
adim += [ca("J10", "Jale Tek Kalem"), fat("j10f", "J10F", "J10", "600", "2026-03-01"), borc("j10b", "J10", "900", "2026-03-02"), elle_kart("kj10", "KJ10", "J10", "600", taksit=2),
         ktah("j10k", "KJ10", "300", "2026-04-10")]
bek.update(cari("J10", 120000, 90000, 120000))
bek.update(fatura("J10F", 60000))
bek.update({"k1:hareket:j10b:kalan": 60000})
bek.update(gorunum("j10b", 30000, "2026-03-02", -44, "J10", "Jale Tek Kalem"))
bek.update(kart("KJ10", 60000, 30000, [30000, 0]))

# J11 — Y10-4 (SUS — BİLİNEN SINIR S125 = C): 01.03 F 600 · 02.03 X 500 (vade 30.03) · 05.03 Y 400 (vade 10.03) · 15.03 kart 900 (elle toplamı = kart; iki sırada da ikisi tamamen kartta —
#   tüketim aynı) · 10.04 kart tahsilatı 300 ⇒ vade sırası Y 100 / X 500, belge sırası X 200 / Y 400 — ayrışıyor. Bakiye 1.500 − 300 = 1.200, kart tutarı 900.
adim += [ca("J11", "Jüt Sıra Ters"), fat("j11f", "J11F", "J11", "600", "2026-03-01"), borc("j11x", "J11", "500", "2026-03-02", "2026-03-30"),
         borc("j11y", "J11", "400", "2026-03-05", "2026-03-10"), elle_kart("kj11", "KJ11", "J11", "900"), ktah("j11k", "KJ11", "300", "2026-04-10")]
sus("J11", "KJ11", 90000, 120000, ["j11x", "j11y"], ["S125 = C", "SK-23"], "J11F")

# J11b — J11 düzeni, kart tahsilatı 900 (kart tamamen ödenir): iki sırada da X 0, Y 0 (Y10-4 — iki okuma aynı payı veriyor → değer). gecikmiş F 600; bakiye 600 = açık (600 + 0 + 0).
adim += [ca("J11b", "Jüt Sıra Tam"), fat("j11bf", "J11BF", "J11b", "600", "2026-03-01"), borc("j11bx", "J11b", "500", "2026-03-02", "2026-03-30"),
         borc("j11by", "J11b", "400", "2026-03-05", "2026-03-10"), elle_kart("kj11b", "KJ11B", "J11b", "900"), ktah("j11bk", "KJ11B", "900", "2026-04-10")]
bek.update(cari("J11b", 60000, 60000, 60000))
bek.update(fatura("J11BF", 60000))
bek.update({"k1:hareket:j11bx:kalan": 0, "k1:hareket:j11bx:vade": "2026-03-30", "k1:hareket:j11by:kalan": 0, "k1:hareket:j11by:vade": "2026-03-10"})
bek.update(yok3("j11bx"))
bek.update(yok3("j11by"))
bek.update(kart("KJ11B", 90000, 90000, [30000, 30000, 30000]))

# J12 — Y10-3 (O = T, Taksitler kartı, hepsi elle): 02.03 X 500 · 05.03 Y 400 · 15.03 kart 900 (açık borç 900 = kart — M1e S2 sırasıyla X 500 + Y 400) · 10.04 kart tahsilatı 300 ⇒ X'e.
#   X Kalan 200, Y Kalan 400; gecikmiş 0 (X, Y kuyrukta 0, taksit 1 ödendi); bakiye 600 = açık (200 + 400).
adim += [ca("J12", "Jöle Eşit Kart"), borc("j12x", "J12", "500", "2026-03-02"), borc("j12y", "J12", "400", "2026-03-05"), elle_kart("kj12", "KJ12", "J12", "900"),
         ktah("j12k", "KJ12", "300", "2026-04-10")]
bek.update(cari("J12", 60000, 0, 60000))
bek.update({"k1:hareket:j12x:kalan": 20000, "k1:hareket:j12y:kalan": 40000})
bek.update(yok3("j12x"))
bek.update(yok3("j12y"))
bek.update(kart("KJ12", 90000, 30000, [30000, 0, 0]))

# J12b — Y10-3, ödemesiz: J12 düzeni, kart tahsilatı YOK ⇒ X Kalan 500, Y Kalan 400 (kuyruk 0 + tüketilen); gecikmiş = taksit 1 300 (01.04); bakiye 900 = açık.
adim += [ca("J12b", "Jöle Ödemesiz"), borc("j12bx", "J12b", "500", "2026-03-02"), borc("j12by", "J12b", "400", "2026-03-05"), elle_kart("kj12b", "KJ12B", "J12b", "900")]
bek.update(cari("J12b", 90000, 30000, 90000))
bek.update({"k1:hareket:j12bx:kalan": 50000, "k1:hareket:j12by:kalan": 40000})
bek.update(yok3("j12bx"))
bek.update(yok3("j12by"))
bek.update(kart("KJ12B", 90000, 0, [0, 0, 0]))

# J13 — Y10-3 sınırı (O = T, kart faturayı da içine aldı — SUS AYNEN, C13.4 (7) / (11)): 01.03 F 600 · 02.03 X 300 · 15.03 kart 900 · 10.04 kart tahsilatı 300. Bakiye 600, kart tutarı 900.
adim += [ca("J13", "Jale Karışık"), fat("j13f", "J13F", "J13", "600", "2026-03-01"), borc("j13x", "J13", "300", "2026-03-02"), elle_kart("kj13", "KJ13", "J13", "900"),
         ktah("j13k", "KJ13", "300", "2026-04-10")]
sus("J13", "KJ13", 90000, 60000, ["j13x"], ["birden çok kalemi tüketti"], "J13F")

# J14 — SK-20 + ödeme (BİLİNEN SINIR S123 = C; susma aynen): 01.03 F 600 · 02.03 X 300 · 15.03 kart 500 (2 × 250) · 10.04 kart tahsilatı 250. Bakiye 650, kart tutarı 500.
adim += [ca("J14", "Jale Az Elle"), fat("j14f", "J14F", "J14", "600", "2026-03-01"), borc("j14x", "J14", "300", "2026-03-02"), elle_kart("kj14", "KJ14", "J14", "500", taksit=2),
         ktah("j14k", "KJ14", "250", "2026-04-10")]
sus("J14", "KJ14", 50000, 65000, ["j14x"], ["SK-20", "BİLİNEN SINIR", "S123 = C"], "J14F")

# J15 — SK-22 + ödeme (BİLİNEN SINIR S124 = C): 01.03 F 600 · 02.03 Z 300 · 03.03 X 900 · 05.03 Y 900 · 15.03 kart 900 · 10.04 kart tahsilatı 300. Bakiye 2.400, kart tutarı 900.
adim += [ca("J15", "Jale Eşitler"), fat("j15f", "J15F", "J15", "600", "2026-03-01"), borc("j15z", "J15", "300", "2026-03-02"), borc("j15x", "J15", "900", "2026-03-03"),
         borc("j15y", "J15", "900", "2026-03-05"), elle_kart("kj15", "KJ15", "J15", "900"), ktah("j15k", "KJ15", "300", "2026-04-10")]
sus("J15", "KJ15", 90000, 240000, ["j15z", "j15x", "j15y"], ["SK-22", "BİLİNEN SINIR", "S124 = C"], "J15F")

# J16 — SK-23 + ödeme (BİLİNEN SINIR S125 = C): 01.03 F 600 · 02.03 X 500 (vade 30.03) · 05.03 Y 700 (vade 10.03) · 15.03 kart 900 · 10.04 kart tahsilatı 300. Bakiye 1.500, kart tutarı 900.
adim += [ca("J16", "Jale Vade Ters"), fat("j16f", "J16F", "J16", "600", "2026-03-01"), borc("j16x", "J16", "500", "2026-03-02", "2026-03-30"),
         borc("j16y", "J16", "700", "2026-03-05", "2026-03-10"), elle_kart("kj16", "KJ16", "J16", "900"), ktah("j16k", "KJ16", "300", "2026-04-10")]
sus("J16", "KJ16", 90000, 150000, ["j16x", "j16y"], ["SK-23", "BİLİNEN SINIR", "S125 = C"], "J16F")

# J17a / J17b — aynı adlı iki cari: J17a kararın örneği AYNEN + 10.04 kart tahsilatı 300 ⇒ X Kalan 200, Y Kalan 700 (kararın sonucu); J17b yalnız Borç 900 (01.03) + 10.04 bağsız tahsilat 300
#   (kartsız) ⇒ Kalan 600 — ödemeler ve kartlar karışmaz. J17a: gecikmiş F 600 + Y 300 = 900; bakiye 1.500 = açık (600 + 200 + 700). J17b: gecikmiş 600; bakiye 600.
adim += ornek("J17a", "Aynı Ödeyen") + [ktah("j17ak", "KJ17a", "300", "2026-04-10"), ca("J17b", "Aynı Ödeyen", "05550000017"), borc("j17bb", "J17b", "900", "2026-03-01"),
                                       tah("j17bt", "J17b", "300", "2026-04-10")]
bek.update(cari("J17a", 150000, 90000, 150000))
bek.update(fatura("J17aF", 60000))
bek.update({"k1:hareket:j17ax:kalan": 20000, "k1:hareket:j17ay:kalan": 70000})
bek.update(yok3("j17ax"))
bek.update(gorunum("j17ay", 30000, "2026-03-05", -41, "J17a", "Aynı Ödeyen"))
bek.update(kart("KJ17a", 90000, 30000, [30000, 0, 0]))
bek.update(cari("J17b", 60000, 60000, 60000))
bek.update({"k1:hareket:j17bb:kalan": 60000})
bek.update(gorunum("j17bb", 60000, "2026-03-01", -45, "J17b", "Aynı Ödeyen"))

ad = "d36-c5-s122-kart-odemesi"
s = {"dil": DIL, "bugun": BUGUN,
     "aciklama": "Bakım 10 (S122 = A): birden çok elle borcu içine alan karta gelen ödeme elle borçların Kalan'ını kartın içine alma sırasıyla, eskiden yeniye düşürür — ödeme ilk elle borcu tam"
                 " bitirir (J1) / aşıp ikinciye geçer (J2) / kartı kapatır (J3), iki ödeme üst üste (J4), üç elle borç (J5), kısmen ödenmiş elle borç (J6), S50 payı (J7), silme (J8) ve geri"
                 " yükleme (J9), tek kalem (J10 — değişmedi), vade ↔ belge sırası ödemeyi ayırıyor (J11 SUS — S125 = C; J11b değer), O = T elle kart (J12, J12b — Y10-3), O = T karışık kart"
                 " (J13 susar), SK-20 / SK-22 / SK-23 + ödeme (J14–J16 SUS — S123 / S124 / S125 = C), aynı adlı iki cari (J17a / J17b)",
     "dayanak": "KARARLAR.md §22 (S122 A; S123 / S124 / S125 = C; Y10-1 … Y10-7), §21 (S120 A), §20 (Y8-4), §13 C13.4 / C13.5",
     "elleBeklenen": bek, "elleYok": yok, "elleBelirsiz": belirsiz, "adimlar": adim + [KONTROL], "ad": ad}
bicim.yaz(os.path.join(D, ad + ".json"), s)
print("%s: %d elle denetim (%d değer + %d yok + %d belirsiz)" % (ad, len(bek) + len(yok) + len(belirsiz), len(bek), len(yok), len(belirsiz)))
