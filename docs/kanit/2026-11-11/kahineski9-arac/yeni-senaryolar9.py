#!/usr/bin/env python3
"""Bakım 9 elle senaryosu (S120 — elle açılan kart tek bir elle borca denk gelmiyorsa yalnız ELLE borçları eskiden yeniye içine alır; faturalar ayrı). Bütün beklenen değerler bu betikte
ELLE — kâhin koşulmadan, karar metninden (scratchpad/kahin-eski9-kararlar.md) ve KARARLAR.md §13 / §20 / §21'den. Tutarlar kuruş. Bugün 15.04.2026; kartlar 15.03'te, taksitleri 01.04 / 01.05 /
01.06 (2 taksitlide 01.04 / 01.05). Adımların yeri sonra g1-sirala.py ile (G1 — her carinin kendi sırası aynen).
Kullanım: python3 -I yeni-senaryolar9.py <senaryolar klasörü>"""
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


def elle_kart(id_, ad, cari, tutar, taksit=3, ilk="2026-04-01", tarih="2026-03-15"):
    return {"id": id_, "islem": "kart_ac", "ad": ad, "cari": cari, "tutar": tutar, "taksit": taksit, "ilkVade": ilk, "tarih": tarih, "mevcut": True}


def kalem(tutar, gun, gunler, cari, kisi):
    return {"amount": tutar, "dueDate": gun, "direction": "in", "label": "Tahsil Edilecek Borç", "state": "overdue", "days": gunler, "cari": cari, "person": kisi}


def gorunum(h, tutar, gun, gunler, cari, kisi):
    """kartın içine almadığı (ya da kısmen aldığı) elle kalem: takvim / Vade Takip / projeksiyon tutarı = kuyruk kalanı (C13.4 (7); §20 Y8-4; §21 Y9-7)"""
    v = {"amount": tutar, "date": gun, "direction": "in"}
    return {"%s:takvim:hareket:%s" % (K, h): kalem(tutar, gun, gunler, cari, kisi), "%s:vadeTakip:hareket:%s" % (K, h): v, "%s:projeksiyon:hareket:%s" % (K, h): dict(v)}


def yok3(h):
    """kartın tamamen içine aldığı elle kalem: takvim / Vade Takip / projeksiyon kalemi yok (kuyruk kalanı 0 — taksitleriyle bir kez)"""
    return {"%s:takvim:hareket:%s" % (K, h): "yok", "%s:vadeTakip:hareket:%s" % (K, h): "yok", "%s:projeksiyon:hareket:%s" % (K, h): "yok"}


def kart(no, toplam, odenen, taksitler):
    b = {"%s:kart:%s:var" % (K, no): True, "%s:kart:%s:toplam" % (K, no): toplam, "%s:kart:%s:odenen" % (K, no): odenen, "%s:kart:%s:kalan" % (K, no): toplam - odenen,
         "%s:kart:%s:mevcutBorc" % (K, no): True}
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


def ornek1(c, isim, tel=None):
    """kararın 1. örneği AYNEN: 01.03 F 600 (en eski) · 02.03 Borç X 500 · 05.03 Borç Y 700 (vadesiz) · 15.03 kart 900 (3 × 300) ⇒ kartta X 500 + Y'nin 400'ü; açık F 600 + Y 300."""
    lo = c.lower()
    return [ca(c, isim, tel), fat(lo + "f", c + "F", c, "600", "2026-03-01"), borc(lo + "x", c, "500", "2026-03-02"), borc(lo + "y", c, "700", "2026-03-05"),
            elle_kart("k" + lo, "K" + c, c, "900")]


def sus(c, kart_no, toplam, bakiye, kalemler, kod):
    """S120 alanında kâhinin SUSTUĞU cari (C13.4 (11) düzeni): yalnız bakiye ve kart tutarı yazılır; `belirsiz` kaydında SK kodu"""
    bek.update(cari(c, bakiye))
    bek.update({"%s:kart:%s:var" % (K, kart_no): True, "%s:kart:%s:toplam" % (K, kart_no): toplam})
    yok.extend(["%s:cari:%s:gecikmis" % (K, c), "%s:kart:%s:kalan" % (K, kart_no)] + ["%s:hareket:%s:kalan" % (K, h) for h in kalemler] + ["%s:takvim:hareket:%s" % (K, kalemler[0])])
    belirsiz.append(["cari %s tanımsız" % c, kod])


# H1 — kararın 1. örneği + 20.03 bağsız tahsilat 600 (S2: kartın dışında kalan en eski vadeli F 600'ü kapatır — Y9-8). F açık 0; X Kalan 500 (tamamen kartta); Y Kalan 700 (300 açık + 400
#   kartta); gecikmiş = Y 300 + 1. taksit 300 = 600; bakiye 1.200. (S120 B olsaydı: kartta F + X 300 → tahsilat X 200 + Y 400'e; F açık 600 kalırdı.)
adim += ornek1("H1", "Hale Sonra Tahsilat") + [tah("h1t", "H1", "600", "2026-03-20")]
bek.update(cari("H1", 120000, 60000, 120000))
bek.update(fatura("H1F", 0))
bek.update({"k1:hareket:h1x:kalan": 50000, "k1:hareket:h1y:kalan": 70000})
bek.update(yok3("h1x"))
bek.update(gorunum("h1y", 30000, "2026-03-05", -41, "H1", "Hale Sonra Tahsilat"))
bek.update(kart("KH1", 90000, 0, [0, 0, 0]))

# H2 — karta eşit birden çok elle borç, eskiden yeniye ilk açık elle borç eşit kalemlerden biri (iki okuma aynı — Y9-5): 01.03 F 600 · 02.03 X 900 · 05.03 Y 900 · kart 900 ⇒ kartta X 900.
#   gecikmiş = F 600 + Y 900 + 1. taksit 300 = 1.800; bakiye 2.400.
adim += [ca("H2", "Hakan İki Eşit"), fat("h2f", "H2F", "H2", "600", "2026-03-01"), borc("h2x", "H2", "900", "2026-03-02"), borc("h2y", "H2", "900", "2026-03-05"),
         elle_kart("kh2", "KH2", "H2", "900")]
bek.update(cari("H2", 240000, 180000, 240000))
bek.update(fatura("H2F", 60000))
bek.update({"k1:hareket:h2x:kalan": 90000, "k1:hareket:h2y:kalan": 90000})
bek.update(yok3("h2x"))
bek.update(gorunum("h2y", 90000, "2026-03-05", -41, "H2", "Hakan İki Eşit"))
bek.update(kart("KH2", 90000, 0, [0, 0, 0]))

# H3 — SK-22 (SUS): karta eşit birden çok elle borç, eskiden yeniye önce eşit olmayan elle borç geliyor: 01.03 F 600 · 02.03 Z 300 · 03.03 X 900 · 05.03 Y 900 · kart 900.
#   A (harf) Z 300 + X 600 / B ("kendi borcu") X 900 — iki okuma ayrışıyor. Bakiye 2.700, kart tutarı 900.
adim += [ca("H3", "Hande Üç Borç"), fat("h3f", "H3F", "H3", "600", "2026-03-01"), borc("h3z", "H3", "300", "2026-03-02"), borc("h3x", "H3", "900", "2026-03-03"),
         borc("h3y", "H3", "900", "2026-03-05"), elle_kart("kh3", "KH3", "H3", "900")]
sus("H3", "KH3", 90000, 270000, ["h3z", "h3x", "h3y"], "SK-22")
yok.append("k1:fatura:H3F:acik")

# H4a — tutarı karta eşit TEK elle borç (Y9-2: bakım 8 kuralı AYNEN), daha eski başka elle borç var: 01.03 X 500 · 05.03 Y 900 · 06.03 F 600 · kart 900 ⇒ kartta Y 900; X 500 ve F 600 açık.
#   gecikmiş = X 500 + F 600 + 1. taksit 300 = 1.400; bakiye 2.000.
adim += [ca("H4a", "Halil Tek Eşit"), borc("h4ax", "H4a", "500", "2026-03-01"), borc("h4ay", "H4a", "900", "2026-03-05"), fat("h4af", "H4AF", "H4a", "600", "2026-03-06"),
         elle_kart("kh4a", "KH4A", "H4a", "900")]
bek.update(cari("H4a", 200000, 140000, 200000))
bek.update(fatura("H4AF", 60000))
bek.update({"k1:hareket:h4ax:kalan": 50000, "k1:hareket:h4ay:kalan": 90000})
bek.update(gorunum("h4ax", 50000, "2026-03-01", -45, "H4a", "Halil Tek Eşit"))
bek.update(yok3("h4ay"))
bek.update(kart("KH4A", 90000, 0, [0, 0, 0]))

# H4b — tek eşit elle borç + eşit fatura (Y9-2: "TEK elle borç" — eşit fatura istisnayı bozmaz; bakım 8'de SK-19 (d) ile susuyordu): 01.03 F 900 · 05.03 Borç 900 · kart 900 ⇒ kartta Borç.
#   gecikmiş = F 900 + 1. taksit 300 = 1.200; bakiye 1.800.
adim += [ca("H4b", "Hilal Eşit Fatura"), fat("h4bf", "H4BF", "H4b", "900", "2026-03-01"), borc("h4bb", "H4b", "900", "2026-03-05"), elle_kart("kh4b", "KH4B", "H4b", "900")]
bek.update(cari("H4b", 180000, 120000, 180000))
bek.update(fatura("H4BF", 90000))
bek.update({"k1:hareket:h4bb:kalan": 90000})
bek.update(yok3("h4bb"))
bek.update(kart("KH4B", 90000, 0, [0, 0, 0]))

# H5 — kartın taşıdığı elle borç borçlu AÇILIŞ (Y8-3 (ii) — elle kayıt): 01.03 Açılış (borç) 500 · 02.03 F 600 · 05.03 Borç Y 700 · kart 900 ⇒ kartta Açılış 500 + Y'nin 400'ü; açık F 600 + Y 300.
#   gecikmiş = F 600 + Y 300 + 1. taksit 300 = 1.200; bakiye 1.800.
adim += [ca("H5", "Hülya Açılış", tarih="2026-03-01", acilis="500"), fat("h5f", "H5F", "H5", "600", "2026-03-02"), borc("h5y", "H5", "700", "2026-03-05"), elle_kart("kh5", "KH5", "H5", "900")]
bek.update(cari("H5", 180000, 120000, 180000))
bek.update(fatura("H5F", 60000))
bek.update({"k1:hareket:acilis:H5:kalan": 50000, "k1:hareket:h5y:kalan": 70000})
bek.update(yok3("acilis:H5"))
bek.update(gorunum("h5y", 30000, "2026-03-05", -41, "H5", "Hülya Açılış"))
bek.update(kart("KH5", 90000, 0, [0, 0, 0]))

# H6a — kısmen ödenmiş elle borç (ana kural; açık kısmıyla): 01.03 X 800 · 05.03 tahsilat 300 (X → 500) · 06.03 F 600 · 07.03 Y 700 · kart 900 ⇒ kartta X'in açık 500'ü + Y'nin 400'ü.
#   X Kalan 500 (tamamen kartta); Y Kalan 700; gecikmiş = F 600 + Y 300 + 1. taksit 300 = 1.200; bakiye 1.800.
adim += [ca("H6a", "Harun Kısmi"), borc("h6ax", "H6a", "800", "2026-03-01"), tah("h6at", "H6a", "300", "2026-03-05"), fat("h6af", "H6AF", "H6a", "600", "2026-03-06"),
         borc("h6ay", "H6a", "700", "2026-03-07"), elle_kart("kh6a", "KH6A", "H6a", "900")]
bek.update(cari("H6a", 180000, 120000, 180000))
bek.update(fatura("H6AF", 60000))
bek.update({"k1:hareket:h6ax:kalan": 50000, "k1:hareket:h6ay:kalan": 70000})
bek.update(yok3("h6ax"))
bek.update(gorunum("h6ay", 30000, "2026-03-07", -39, "H6a", "Harun Kısmi"))
bek.update(kart("KH6A", 90000, 0, [0, 0, 0]))

# H6b — kısmen ödenmiş elle borcun açık tutarı karta eşit (Y9-2 — bakım 8 kuralı aynen, "açık tutar"): 01.03 X 1.200 · 05.03 tahsilat 300 · 06.03 F 600 · kart 900 ⇒ kartta X'in açık 900'ü.
#   X Kalan 900; gecikmiş = F 600 + 1. taksit 300 = 900; bakiye 1.500.
adim += [ca("H6b", "Hikmet Kısmi Eşit"), borc("h6bx", "H6b", "1200", "2026-03-01"), tah("h6bt", "H6b", "300", "2026-03-05"), fat("h6bf", "H6BF", "H6b", "600", "2026-03-06"),
         elle_kart("kh6b", "KH6B", "H6b", "900")]
bek.update(cari("H6b", 150000, 90000, 150000))
bek.update(fatura("H6BF", 60000))
bek.update({"k1:hareket:h6bx:kalan": 90000})
bek.update(yok3("h6bx"))
bek.update(kart("KH6B", 90000, 0, [0, 0, 0]))

# H7 — açık elle borçların toplamı = kart tutarı (Y9-6 sınırı: hepsi kartta): 01.03 F 600 · 02.03 X 400 · 05.03 Y 500 · kart 900 ⇒ kartta X 400 + Y 500; açık F 600.
#   gecikmiş = F 600 + 1. taksit 300 = 900; bakiye 1.500.
adim += [ca("H7", "Hasan Tam Dolu"), fat("h7f", "H7F", "H7", "600", "2026-03-01"), borc("h7x", "H7", "400", "2026-03-02"), borc("h7y", "H7", "500", "2026-03-05"),
         elle_kart("kh7", "KH7", "H7", "900")]
bek.update(cari("H7", 150000, 90000, 150000))
bek.update(fatura("H7F", 60000))
bek.update({"k1:hareket:h7x:kalan": 40000, "k1:hareket:h7y:kalan": 50000})
bek.update(yok3("h7x"))
bek.update(yok3("h7y"))
bek.update(kart("KH7", 90000, 0, [0, 0, 0]))

# H8 — SK-20 (SUS; NOT (2)): açık elle borçların toplamı kart tutarından az: 01.03 F 600 · 02.03 X 300 · kart 500 (2 × 250). Bakiye 900, kart tutarı 500.
adim += [ca("H8", "Haluk Az Elle"), fat("h8f", "H8F", "H8", "600", "2026-03-01"), borc("h8x", "H8", "300", "2026-03-02"), elle_kart("kh8", "KH8", "H8", "500", taksit=2)]
sus("H8", "KH8", 50000, 90000, ["h8x"], "SK-20")
yok.append("k1:fatura:H8F:acik")

# H9a — SK-23 (SUS): vade sırası ile belge tarihi sırası farklı kalemleri alıyor: 01.03 F 600 · 02.03 X 500 (vade 30.03) · 05.03 Y 700 (vade 10.03) · kart 900.
#   Vade: Y 700 + X 200 / belge: X 500 + Y 400. Bakiye 1.800, kart tutarı 900.
adim += [ca("H9a", "Hamdi Vade Ters"), fat("h9af", "H9AF", "H9a", "600", "2026-03-01"), borc("h9ax", "H9a", "500", "2026-03-02", "2026-03-30"),
         borc("h9ay", "H9a", "700", "2026-03-05", "2026-03-10"), elle_kart("kh9a", "KH9A", "H9a", "900")]
sus("H9a", "KH9A", 90000, 180000, ["h9ax", "h9ay"], "SK-23")
yok.append("k1:fatura:H9AF:acik")

# H9b — vadeli elle borçlar, iki sıra aynı tüketimi veriyor (Y9-4 tek okuma): 01.03 F 600 · 02.03 X 500 (vade 20.03) · 05.03 Y 700 (vade 25.03) · kart 900 ⇒ kartta X 500 + Y'nin 400'ü.
#   gecikmiş = F 600 + Y 300 (vade 25.03) + 1. taksit 300 = 1.200; bakiye 1.800.
adim += [ca("H9b", "Hamza Vade Düz"), fat("h9bf", "H9BF", "H9b", "600", "2026-03-01"), borc("h9bx", "H9b", "500", "2026-03-02", "2026-03-20"),
         borc("h9by", "H9b", "700", "2026-03-05", "2026-03-25"), elle_kart("kh9b", "KH9B", "H9b", "900")]
bek.update(cari("H9b", 180000, 120000, 180000))
bek.update(fatura("H9BF", 60000))
bek.update({"k1:hareket:h9bx:kalan": 50000, "k1:hareket:h9bx:vade": "2026-03-20", "k1:hareket:h9by:kalan": 70000, "k1:hareket:h9by:vade": "2026-03-25"})
bek.update(yok3("h9bx"))
bek.update(gorunum("h9by", 30000, "2026-03-25", -21, "H9b", "Hamza Vade Düz"))
bek.update(kart("KH9B", 90000, 0, [0, 0, 0]))

# H10 — SK-21 (SUS): kararın 1. örneği + 10.04 bağsız tahsilat 1.200 (S2 + S50: F 600 → Y 300 → 1. taksit 300) — çok elle borçlu kartın 300'ü ödendi; ödemenin X / Y'ye dağılımı kararda yok.
#   Bakiye 600, kart tutarı 900.
adim += ornek1("H10", "Haydar Taksit Öder") + [tah("h10t", "H10", "1200", "2026-04-10")]
sus("H10", "KH10", 90000, 60000, ["h10x", "h10y"], "SK-21")
yok.append("k1:fatura:H10F:acik")

# H11 — SK-21 (SUS): kararın 1. örneği + 10.04 kart tahsilatı 300 (kartın 1. taksitine). Bakiye 1.500, kart tutarı 900.
adim += ornek1("H11", "Hacer Kart Öder") + [{"id": "h11k", "islem": "kart_tahsilat", "kayit": "KH11", "tutar": "300", "tarih": "2026-04-10"}]
sus("H11", "KH11", 90000, 150000, ["h11x", "h11y"], "SK-21")
yok.append("k1:fatura:H11F:acik")

# H12 — kararın 1. örneği + kart açıldıktan SONRA 20.03 Borç Z 200 (vadesiz; kartın içine girmez — Y9-8): gecikmiş = F 600 + Y 300 + Z 200 + 1. taksit 300 = 1.400; bakiye 2.000.
adim += ornek1("H12", "Hayri Yeni Borç") + [borc("h12z", "H12", "200", "2026-03-20")]
bek.update(cari("H12", 200000, 140000, 200000))
bek.update(fatura("H12F", 60000))
bek.update({"k1:hareket:h12x:kalan": 50000, "k1:hareket:h12y:kalan": 70000, "k1:hareket:h12z:kalan": 20000})
bek.update(yok3("h12x"))
bek.update(gorunum("h12y", 30000, "2026-03-05", -41, "H12", "Hayri Yeni Borç"))
bek.update(gorunum("h12z", 20000, "2026-03-20", -26, "H12", "Hayri Yeni Borç"))
bek.update(kart("KH12", 90000, 0, [0, 0, 0]))

# H13 — kararın 1. örneği + 20.03 faturasız stok Satış İadesi 200 (bağsız kapatıcı, S2: F 600 → F 400): gecikmiş = F 400 + Y 300 + 1. taksit 300 = 1.000; bakiye 1.600.
adim += ornek1("H13", "Hayriye İade") + [{"id": "h13i", "islem": "stok_iade", "cari": "H13", "tutar": "200", "tarih": "2026-03-20"}]
bek.update(cari("H13", 160000, 100000, 160000))
bek.update(fatura("H13F", 40000))
bek.update({"k1:hareket:h13x:kalan": 50000, "k1:hareket:h13y:kalan": 70000})
bek.update(yok3("h13x"))
bek.update(gorunum("h13y", 30000, "2026-03-05", -41, "H13", "Hayriye İade"))
bek.update(kart("KH13", 90000, 0, [0, 0, 0]))

# H14 — kararın 1. örneği + 20.03 bağsız tahsilat 800 (S2: F 600 → Y'nin açık 300'ünün 200'ü; karta ulaşmaz): Y'nin kuyruk kalanı 100, Kalan 100 + 400 = 500; X Kalan 500; F 0.
#   gecikmiş = Y 100 + 1. taksit 300 = 400; bakiye 1.000.
adim += ornek1("H14", "Hatice Kısmi Tahsil") + [tah("h14t", "H14", "800", "2026-03-20")]
bek.update(cari("H14", 100000, 40000, 100000))
bek.update(fatura("H14F", 0))
bek.update({"k1:hareket:h14x:kalan": 50000, "k1:hareket:h14y:kalan": 50000})
bek.update(yok3("h14x"))
bek.update(gorunum("h14y", 10000, "2026-03-05", -41, "H14", "Hatice Kısmi Tahsil"))
bek.update(kart("KH14", 90000, 0, [0, 0, 0]))

# H15a / H15b — aynı adlı iki cari: H15a kararın 1. örneği (d34 E11 ile aynı değerler), H15b yalnız Borç 900 (vadesiz 01.03, kartsız) — kart / tüketim karışmaz.
adim += ornek1("H15a", "Aynı Elleci") + [ca("H15b", "Aynı Elleci", "05550000015"), borc("h15bb", "H15b", "900", "2026-03-01")]
bek.update(cari("H15a", 180000, 120000, 180000))
bek.update(fatura("H15aF", 60000))
bek.update({"k1:hareket:h15ax:kalan": 50000, "k1:hareket:h15ay:kalan": 70000})
bek.update(yok3("h15ax"))
bek.update(gorunum("h15ay", 30000, "2026-03-05", -41, "H15a", "Aynı Elleci"))
bek.update(kart("KH15a", 90000, 0, [0, 0, 0]))
bek.update(cari("H15b", 90000, 90000, 90000))
bek.update({"k1:hareket:h15bb:kalan": 90000})
bek.update(gorunum("h15bb", 90000, "2026-03-01", -45, "H15b", "Aynı Elleci"))

ad = "d35-c5-s120-elle-borclar"
s = {"dil": DIL, "bugun": BUGUN,
     "aciklama": "Bakım 9 (S120 = A): elle kart (açık borç kart tutarından fazla) tek bir elle borca denk gelmiyorsa yalnız ELLE borçları eskiden yeniye içine alır, faturalar ayrı — kart sonrası"
                 " tahsilat (H1, H14), yeni borç (H12), stok iadesi (H13), birden çok eşit elle borç (H2; H3 SK-22 susar), tek eşit elle borç (H4a, H4b — bakım 8 aynen), borçlu Açılış (H5),"
                 " kısmen ödenmiş elle borç (H6a, H6b), elle toplamı = kart (H7), elle toplamı < kart (H8 SK-20 susar), vade ↔ belge sırası (H9a SK-23 susar, H9b), kart ödemeli (H10, H11 SK-21"
                 " susar), aynı adlı iki cari (H15a / H15b)",
     "dayanak": "KARARLAR.md §21 (S120 A; Y9-1 … Y9-9; SK-20 … SK-23), §20 (S110 A; Y8-3 / Y8-4 / Y8-5), §13 C13.4 / C13.5",
     "elleBeklenen": bek, "elleYok": yok, "elleBelirsiz": belirsiz, "adimlar": adim + [KONTROL], "ad": ad}
bicim.yaz(os.path.join(D, ad + ".json"), s)
print("%s: %d elle denetim (%d değer + %d yok + %d belirsiz)" % (ad, len(bek) + len(yok) + len(belirsiz), len(bek), len(yok), len(belirsiz)))
