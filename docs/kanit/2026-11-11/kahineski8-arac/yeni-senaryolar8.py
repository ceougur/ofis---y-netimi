#!/usr/bin/env python3
"""Bakım 8 elle senaryosu (S110 — kart açılırken açık borç kart tutarından fazla: kart KENDİ borcunu taşır). Bütün beklenen değerler bu betikte ELLE — kâhin koşulmadan, karar metninden
(scratchpad/kahin-eski8-kararlar.md) ve KARARLAR.md §13 / §18 / §19 / §20'den. Tutarlar kuruş. Bugün 15.04.2026.
Kullanım: python3 -I yeni-senaryolar8.py <senaryolar klasörü>"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bicim  # noqa: E402

D = sys.argv[1]
DIL = "destekofis-cari/3"
BUGUN = "2026-04-15"
K = "k1"
KONTROL = {"id": K, "islem": "kontrol", "gecikmis": True, "gorunumToplam": True, "acikToplam": True}


def ca(ad, isim, tel=None):
    a = {"id": "c" + ad.lower(), "islem": "cari_ac", "ad": ad, "isim": isim, "tarih": "2026-02-01"}
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


def elle_kart(id_, ad, cari, tutar, taksit=3, ilk="2026-04-01", tarih="2026-03-15"):
    return {"id": id_, "islem": "kart_ac", "ad": ad, "cari": cari, "tutar": tutar, "taksit": taksit, "ilkVade": ilk, "tarih": tarih, "mevcut": True}


def sk(id_, ad, cari, tutar, tarih, taksit=2, ilk="2026-04-01"):
    return {"id": id_, "islem": "stok_satis_taksit", "ad": ad, "cari": cari, "tutar": tutar, "tarih": tarih, "taksit": taksit, "ilkVade": ilk}


def kalem(tutar, gun, gunler, cari, kisi):
    return {"amount": tutar, "dueDate": gun, "direction": "in", "label": "Tahsil Edilecek Borç", "state": "overdue", "days": gunler, "cari": cari, "person": kisi}


def gorunum(h, tutar, gun, gunler, cari, kisi):
    """kart kapsamında olmayan elle Borç: takvim / Vade Takip / projeksiyon tutarı = kuyruk kalanı (C13.4 (7); §20 Y8-2 / Y8-4)"""
    v = {"amount": tutar, "date": gun, "direction": "in"}
    return {"%s:takvim:hareket:%s" % (K, h): kalem(tutar, gun, gunler, cari, kisi), "%s:vadeTakip:hareket:%s" % (K, h): v, "%s:projeksiyon:hareket:%s" % (K, h): dict(v)}


def yok3(h):
    """kartın tükettiği (ya da kapanmış) elle Borç: takvim / Vade Takip / projeksiyon kalemi yok (kuyruk kalanı 0 — taksitleriyle bir kez)"""
    return {"%s:takvim:hareket:%s" % (K, h): "yok", "%s:vadeTakip:hareket:%s" % (K, h): "yok", "%s:projeksiyon:hareket:%s" % (K, h): "yok"}


def kart(no, toplam, odenen, taksitler, mevcut=True):
    b = {"%s:kart:%s:var" % (K, no): True, "%s:kart:%s:toplam" % (K, no): toplam, "%s:kart:%s:odenen" % (K, no): odenen, "%s:kart:%s:kalan" % (K, no): toplam - odenen}
    if mevcut:
        b["%s:kart:%s:mevcutBorc" % (K, no)] = True
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


adim, bek, yok, belirsiz = [], {}, [], []

# E1 — KARARIN ÖRNEĞİ (AYNEN; B'nin ayrıştığı düzen — F en eski): elle borç 900 + fatura 600, kart 900 (3 × 300) ⇒ 3 × 300 taksit + fatura 600 ayrı açık; gecikmiş 900.
#   01.03 F 600 · 05.03 Borç 900 (vade 10.03) · 15.03 Mevcut Borç kartı 900 (01.04 / 01.05 / 01.06). Kart Borç 900'ü taşır (açık tutarı kart tutarına eşit tek elle kayıt — Y8-3).
#   gecikmiş = F 600 (vade 01.03) + 1. taksit 300 (01.04) = 900. Borç'un Kalan'ı (defter kalanı, K6.5 (a)) = 0 + 900 − 0 = 900; takvimde Borç yok (kart taksitleriyle bir kez).
#   B olsaydı: F 600 + Borç'un 300'ü kartta, Borç 600 açık (takvim 600) — gecikmiş yine 900.
adim += [ca("E1", "Ebru Örnek"), fat("e1f", "E1F", "E1", "600", "2026-03-01"), borc("e1b", "E1", "900", "2026-03-05", "2026-03-10"), elle_kart("ke1", "KE1", "E1", "900")]
bek.update(cari("E1", 150000, 90000, 150000))
bek.update({"k1:fatura:E1F:acik": 60000, "k1:hareket:e1b:kalan": 90000, "k1:hareket:e1b:vade": "2026-03-10", "k1:takvim:fatura:E1F": {"amount": 60000, "direction": "in"}})
bek.update(yok3("e1b"))
bek.update(kart("KE1", 90000, 0, [0, 0, 0]))

# E2 — aynı örnek, elle borç en eski (A = B: S2'nin ilk kalemi kartın kendi borcu). 01.03 Borç 900 (vade 02.03) · 05.03 F 600 · 15.03 kart 900. gecikmiş = F 600 (05.03) + 1. taksit 300.
adim += [ca("E2", "Emre Borçönce"), borc("e2b", "E2", "900", "2026-03-01", "2026-03-02"), fat("e2f", "E2F", "E2", "600", "2026-03-05"), elle_kart("ke2", "KE2", "E2", "900")]
bek.update(cari("E2", 150000, 90000, 150000))
bek.update({"k1:fatura:E2F:acik": 60000, "k1:hareket:e2b:kalan": 90000, "k1:hareket:e2b:vade": "2026-03-02", "k1:takvim:fatura:E2F": {"amount": 60000, "direction": "in"}})
bek.update(yok3("e2b"))
bek.update(kart("KE2", 90000, 0, [0, 0, 0]))

# E3 — SINIR: kart tutarı = açık borç (O = T — kural devreye girmez, eski davranış AYNEN): 01.03 F 600 · 15.03 kart 600 (2 × 300). Kart F'yi tüketir (tek kalem).
#   F açık (defter kalanı) = 0 + 600 − 0 = 600; gecikmiş 1. taksit 300.
#   KOŞUDAN SONRA DEĞİŞEN ELLE DEĞER (raporda açıkça): ilk yazımda `takvim:fatura:E3F` "yazılmaz" (elleYok) yazılmıştı — yanlış okuma; kâhinin kendi K6.5 (1) kuralı ("kartlı caride fatura
#   kalemi NET: açık − kartın açık kapsamı, kapsanan borç kartın taksitleriyle bir kez") bu caride (tek satış faturası, elle kayıt yok) kalemi yazar: 600 − 600 = 0 → "yok". Eski kâhinde de aynı.
adim += [ca("E3", "Ece Eşit"), fat("e3f", "E3F", "E3", "600", "2026-03-01"), elle_kart("ke3", "KE3", "E3", "600", taksit=2)]
bek.update(cari("E3", 60000, 30000, 60000))
bek.update({"k1:fatura:E3F:acik": 60000, "k1:takvim:fatura:E3F": "yok"})
bek.update(kart("KE3", 60000, 0, [0, 0]))

# E4 — SINIR: açık borç kart tutarını 1 KURUŞ aşıyor (O = T + 0,01 — "fazla"): 01.03 F 0,01 · 05.03 Borç 900 (vade 10.03) · 15.03 kart 900. Kart Borç'u taşır; F 0,01 ayrı açık.
#   gecikmiş = 0,01 + 300 = 300,01. (B / eski kural: F 0,01 + Borç'un 899,99'u kartta — iki kalem, eski kâhin susar.)
adim += [ca("E4", "Erkan Kuruş"), fat("e4f", "E4F", "E4", "0,01", "2026-03-01"), borc("e4b", "E4", "900", "2026-03-05", "2026-03-10"), elle_kart("ke4", "KE4", "E4", "900")]
bek.update(cari("E4", 90001, 30001, 90001))
bek.update({"k1:fatura:E4F:acik": 1, "k1:hareket:e4b:kalan": 90000, "k1:takvim:fatura:E4F": {"amount": 1, "direction": "in"}})
bek.update(yok3("e4b"))
bek.update(kart("KE4", 90000, 0, [0, 0, 0]))

# E5 — SATIŞ KOLU: başka açık borcu olan cariye stoktan taksitli satış. 01.03 Borç 900 (vade 02.03) · 05.03 stoktan 600 veresiye satış + 2 taksit (01.04 / 01.05).
#   Kart KENDİ satışını taşır; Borç 900 ayrı açık (takvim 900). gecikmiş = Borç 900 + 1. taksit 300 = 1.200. (B: Borç'un 600'ü kartta — Borç takvimde 300, satış 600 açık.)
adim += [ca("E5", "Elif Satış"), borc("e5b", "E5", "900", "2026-03-01", "2026-03-02"), sk("ke5", "KE5", "E5", "600", "2026-03-05")]
bek.update(cari("E5", 150000, 120000))
bek.update({"k1:hareket:e5b:kalan": 90000, "k1:hareket:e5b:vade": "2026-03-02"})
bek.update(gorunum("e5b", 90000, "2026-03-02", -44, "E5", "Elif Satış"))
bek.update(kart("KE5", 60000, 0, [0, 0], mevcut=False))
yok += ["k1:kart:KE5:mevcutBorc"]  # Y7-2 (4) aynen

# E6 — satış kolu + kart açıldıktan SONRA bağsız tahsilat (S2 + S50 aynen): E5 düzeni + 10.04 tahsilat 1.000 → vade sırası: Borç 900 (02.03), 1. taksit (01.04) 100.
#   Borç Kalan 0; kart ödenen 100 (1. taksit 100); gecikmiş = 1. taksitin kalanı 200. (B: Borç'un 600'ü kartta — Kalan 500.)
adim += [ca("E6", "Eda Sonra Tahsilat"), borc("e6b", "E6", "900", "2026-03-01", "2026-03-02"), sk("ke6", "KE6", "E6", "600", "2026-03-05"),
         {"id": "e6t", "islem": "tahsilat", "cari": "E6", "tutar": "1000", "tarih": "2026-04-10"}]
bek.update(cari("E6", 50000, 20000))
bek.update({"k1:hareket:e6b:kalan": 0})
bek.update(yok3("e6b"))
bek.update(kart("KE6", 60000, 10000, [10000, 0], mevcut=False))

# E7 — elle kol + kart açıldıktan SONRA yeni borç ve bağsız tahsilat: E1 düzeni + 20.03 Borç 200 (vade 25.03) + 10.04 tahsilat 500.
#   Kart Borç 900'ü taşır; 10.04'te kuyruk (vade sırası): F 600 (01.03) → tahsilat 500 F'ye; Borç 200 (25.03) açık; taksitler açık. Yeni borç kartın kapsamına girmez.
#   gecikmiş = F 100 + Borç 200 + 1. taksit 300 = 600; bakiye 600 + 900 + 200 − 500 = 1.200.
adim += [ca("E7", "Engin Yeni Borç"), fat("e7f", "E7F", "E7", "600", "2026-03-01"), borc("e7b", "E7", "900", "2026-03-05", "2026-03-10"), elle_kart("ke7", "KE7", "E7", "900"),
         borc("e7c", "E7", "200", "2026-03-20", "2026-03-25"), {"id": "e7t", "islem": "tahsilat", "cari": "E7", "tutar": "500", "tarih": "2026-04-10"}]
bek.update(cari("E7", 120000, 60000, 120000))
bek.update({"k1:fatura:E7F:acik": 10000, "k1:hareket:e7b:kalan": 90000, "k1:hareket:e7c:kalan": 20000, "k1:hareket:e7c:vade": "2026-03-25",
            "k1:takvim:fatura:E7F": {"amount": 10000, "direction": "in"}})
bek.update(yok3("e7b"))
bek.update(gorunum("e7c", 20000, "2026-03-25", -21, "E7", "Engin Yeni Borç"))
bek.update(kart("KE7", 90000, 0, [0, 0, 0]))

# E8 — elle kol + kart açıldıktan SONRA faturasız stok Satış İadesi 200 (bağsız kapatıcı, vade sırasıyla): F 600 (01.03) → F 400 açık. gecikmiş = 400 + 300 = 700; bakiye 1.300.
adim += [ca("E8", "Esra İade"), fat("e8f", "E8F", "E8", "600", "2026-03-01"), borc("e8b", "E8", "900", "2026-03-05", "2026-03-10"), elle_kart("ke8", "KE8", "E8", "900"),
         {"id": "e8i", "islem": "stok_iade", "cari": "E8", "tutar": "200", "tarih": "2026-03-20"}]
bek.update(cari("E8", 130000, 70000, 130000))
bek.update({"k1:fatura:E8F:acik": 40000, "k1:hareket:e8b:kalan": 90000, "k1:takvim:fatura:E8F": {"amount": 40000, "direction": "in"}})
bek.update(yok3("e8b"))
bek.update(kart("KE8", 90000, 0, [0, 0, 0]))

# E9 — S101 × S110 (S101 aynen): 01.03 tahsilat 400 (avans) · 05.03 stoktan 600 satış + 2 taksit (avans satışın 400'ünü kapatır → kartın 400'ü ödenmiş: 1. taksit 300 + 2. taksit 100)
#   · 10.03 Borç 500 (vade 20.03) — kontrol anında satış dışında açık borç (bakım 7'de Y7-2 (5) ile susuyordu; S110 A: kart yalnız kendi satışını kapsar).
#   Kart ödenen 400, kalan 200; Borç 500 açık (takvim 500); gecikmiş = Borç 500 (2. taksit 01.05); bakiye 600 + 500 − 400 = 700.
adim += [ca("E9", "Eylem Avanslı"), {"id": "e9t", "islem": "tahsilat", "cari": "E9", "tutar": "400", "tarih": "2026-03-01"}, sk("ke9", "KE9", "E9", "600", "2026-03-05"),
         borc("e9b", "E9", "500", "2026-03-10", "2026-03-20")]
bek.update(cari("E9", 70000, 50000))
bek.update({"k1:hareket:e9b:kalan": 50000, "k1:hareket:e9b:vade": "2026-03-20"})
bek.update(gorunum("e9b", 50000, "2026-03-20", -26, "E9", "Eylem Avanslı"))
bek.update(kart("KE9", 60000, 40000, [30000, 10000], mevcut=False))
yok += ["k1:kart:KE9:mevcutBorc"]

# E10 — karşı yönlü kalemli cari (aynı kişiden alış 300): 01.03 F 600 · 02.03 alış 300 · 05.03 Borç 900 (vade 10.03) · 15.03 kart 900. Kart (G2 (b): iki okumada da kabul) Borç'u taşır;
#   karşı yönlü kalemli kartlı caride net görünüm / gecikmiş tanımsız (C16.2 / Y6-10 AYNEN — susar); belge durumu (5) A brüt: F açık 600; bakiye 1.200; kart kalanı 900.
adim += [ca("E10", "Erol Çift Yönlü"), fat("e10f", "E10F", "E10", "600", "2026-03-01"), dict(fat("e10a", "E10A", "E10", "300", "2026-03-02"), tur="alis"),
         borc("e10b", "E10", "900", "2026-03-05", "2026-03-10"), elle_kart("ke10", "KE10", "E10", "900")]
bek.update(cari("E10", 120000))
bek.update({"k1:fatura:E10F:acik": 60000, "k1:kart:KE10:toplam": 90000, "k1:kart:KE10:kalan": 90000})
yok += ["k1:hareket:e10b:kalan", "k1:takvim:hareket:e10b", "k1:cari:E10:gecikmis"]
belirsiz += [["cari E10 net görünüm tanımsız"]]

# E11–E13 — SK-19 (kâhin SUSAR): "elle kartta taksitlendirilen borç" tek okumayla belirlenemiyor (§20 Y8-3).
# E11 (a) birden çok elle borç, kart hiçbirine eşit değil (NOT'un örneği): 01.03 F 600 · 02.03 Borç X 500 · 05.03 Borç Y 700 · 15.03 kart 900.
adim += [ca("E11", "Ekin İki Borç"), fat("e11f", "E11F", "E11", "600", "2026-03-01"), borc("e11x", "E11", "500", "2026-03-02"), borc("e11y", "E11", "700", "2026-03-05"),
         elle_kart("ke11", "KE11", "E11", "900")]
bek.update(cari("E11", 180000))
bek.update({"k1:kart:KE11:var": True, "k1:kart:KE11:toplam": 90000})
yok += ["k1:fatura:E11F:acik", "k1:hareket:e11x:kalan", "k1:hareket:e11y:kalan", "k1:cari:E11:gecikmis", "k1:kart:KE11:kalan", "k1:takvim:hareket:e11x"]
belirsiz += [["cari E11 tanımsız", "SK-19"]]
# E12 (b) açık tutarı kart tutarına eşit kalem FATURA (elle kayıt değil): 01.03 Borç 900 · 05.03 F 600 · 15.03 kart 600 (2 × 300).
adim += [ca("E12", "Eray Eşit Fatura"), borc("e12b", "E12", "900", "2026-03-01"), fat("e12f", "E12F", "E12", "600", "2026-03-05"), elle_kart("ke12", "KE12", "E12", "600", taksit=2)]
bek.update(cari("E12", 150000))
bek.update({"k1:kart:KE12:toplam": 60000})
yok += ["k1:fatura:E12F:acik", "k1:cari:E12:gecikmis", "k1:kart:KE12:kalan", "k1:hareket:e12b:kalan"]
belirsiz += [["cari E12 tanımsız", "SK-19"]]
# E13 (c) tek elle borç kart tutarından büyük, eşit kalem yok: 01.03 Borç 900 · 05.03 F 600 · 15.03 kart 500 (2 × 250).
adim += [ca("E13", "Ezgi Parça"), borc("e13b", "E13", "900", "2026-03-01"), fat("e13f", "E13F", "E13", "600", "2026-03-05"), elle_kart("ke13", "KE13", "E13", "500", taksit=2)]
bek.update(cari("E13", 150000))
bek.update({"k1:kart:KE13:toplam": 50000})
yok += ["k1:fatura:E13F:acik", "k1:cari:E13:gecikmis", "k1:kart:KE13:kalan", "k1:hareket:e13b:kalan"]
belirsiz += [["cari E13 tanımsız", "SK-19"]]

# E14a / E14b — aynı adlı iki cari: E14a kararın örneği (E1 ile aynı değerler), E14b yalnız Borç 600 (vadesiz 01.03 — ertesi gün gecikmiş, S1) — kart / tüketim karışmaz.
adim += [ca("E14a", "Aynı Kartçı"), ca("E14b", "Aynı Kartçı", "05550000014"), fat("e14f", "E14F", "E14a", "600", "2026-03-01"),
         borc("e14ab", "E14a", "900", "2026-03-05", "2026-03-10"), borc("e14bb", "E14b", "600", "2026-03-01"), elle_kart("ke14", "KE14", "E14a", "900")]
bek.update(cari("E14a", 150000, 90000, 150000))
bek.update({"k1:fatura:E14F:acik": 60000, "k1:hareket:e14ab:kalan": 90000})
bek.update(yok3("e14ab"))
bek.update(kart("KE14", 90000, 0, [0, 0, 0]))
bek.update(cari("E14b", 60000, 60000, 60000))
bek.update({"k1:hareket:e14bb:kalan": 60000})

ad = "d34-c5-s110-kendi-borcu"
s = {"dil": DIL, "bugun": BUGUN,
     "aciklama": "Bakım 8 (S110 = A): kart açılırken açık borç kart tutarından fazlaysa kart KENDİ borcunu taşır — elle kart (kararın örneği E1, E2, E4, E7, E8, E14), satışla açılan kart (E5, E6, E9),"
                 " sınır O = T (E3, eski kural aynen), karşı yönlü kalem (E10, susar), SK-19 (E11–E13, susar)",
     "dayanak": "KARARLAR.md §20 (S110 A; Y8-1 … Y8-6; SK-19), §13 C13.4 / C13.5, §18 Y6-4, §19 Y7-2 / Y7-3",
     "elleBeklenen": bek, "elleYok": yok, "elleBelirsiz": belirsiz, "adimlar": adim + [KONTROL], "ad": ad}
bicim.yaz(os.path.join(D, ad + ".json"), s)
print("%s: %d elle denetim (%d değer + %d yok + %d belirsiz)" % (ad, len(bek) + len(yok) + len(belirsiz), len(bek), len(yok), len(belirsiz)))
