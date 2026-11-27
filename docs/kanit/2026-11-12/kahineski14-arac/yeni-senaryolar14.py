#!/usr/bin/env python3
"""Bakım 14 elle senaryoları (TOPLU bakım — S130 = A, S129 = A onay, S131 / S133 / S134 / S135 = C). Bütün beklenen değerler bu betikte ELLE — kâhin koşulmadan, karar metinlerinden
(scratchpad/kahin-eski14-kararlar.md) ve KARARLAR.md §8 (K6.3, KS7, ŞÜPHELİ KALAN), §13 (C13.4 / C13.5), §16 (C16.1), §17 (S95), §21 (Y9-2), §25'ten. Tutarlar kuruş. Bugün 15.06.2026.
  d39-c5-s130-supheli-kalemleri: S130'un DEĞER alanı (kararın örneği AYNEN, tek kalemi bitirir / aşar / hepsini bitirir, Değersiz sonrası (tam / kısmen), kısmen tahsilat, tahsilat şüpheliyi aşar,
    sonradan doğan kalem sırada sonra, şüpheli kalan kalemleri aşar, iki şüpheli kaydı, aynı adlı iki cari) + S129'un iki örneği (kart göstergeleri tek kuyruktan) + Yeni Borç kartlı S129.
  d40-c5-s130-sus-bilinen-sinir: SUS alanları — SK-28 (a) (iki zaman okuması ayrışıyor; tahsilatlı biçimi), SK-28 (b) (şüpheliden düşen bağlı çek), SK-27 (taksit kartı; verilen avans),
    S133 = C (SUS) ve S133'ün dışı (Y9-2 değer), S134 = C (SUS) ve kilitten sonraki netleşme (S95 değer), S135 = C (SK-20 + S135 metni).
NOT (4) (Y14-8): her S130 değer carisinde Σ görünen kalem = bakiye − R (R kalemleri aşarsa 0) burada assert edilir; kâhinin `cariToplam`'ı bu toplamdır.
Adımların yeri sonra g1-sirala.py ile (G1 — her carinin kendi sırası aynen).
Kullanım: python3 -I yeni-senaryolar14.py <senaryolar klasörü>"""
import datetime
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bicim  # noqa: E402

D = sys.argv[1]
DIL = "destekofis-cari/3"
BUGUN = "2026-06-15"
K = "k1"
KONTROL = {"id": K, "islem": "kontrol", "gecikmis": True, "gorunumToplam": True, "acikToplam": True}
B = datetime.date.fromisoformat(BUGUN)


def gun(t):
    return (datetime.date.fromisoformat(t) - B).days


def ca(ad, isim, tarih="2026-03-01", tel=None, **ek):
    a = {"id": "c" + ad.lower(), "islem": "cari_ac", "ad": ad, "isim": isim, "tarih": tarih}
    if tel:
        a["tel"] = tel
    a.update(ek)
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


def tah(id_, cari, tutar, tarih):
    return {"id": id_, "islem": "tahsilat", "cari": cari, "tutar": tutar, "tarih": tarih}


def sup(id_, ad, cari, tutar, tarih):
    return {"id": id_, "islem": "supheli_al", "ad": ad, "cari": cari, "tutar": tutar, "tarih": tarih}


def deg(id_, supheli, tutar, tarih):
    return {"id": id_, "islem": "degersiz", "supheli": supheli, "tutar": tutar, "tarih": tarih}


def kart_ac(id_, ad, cari, tutar, taksit, ilk, tarih, mevcut=True):
    return {"id": id_, "islem": "kart_ac", "ad": ad, "cari": cari, "tutar": tutar, "taksit": taksit, "ilkVade": ilk, "tarih": tarih, "mevcut": mevcut}


ISIM = {}


def kalem(c, h, tutar, tarih, yon="in"):
    """K6.3 / C16.1 kalemi: takvim (geçmiş + bugün + 7), Vade Takip (bugün + 6'ya kadar), projeksiyon (bugün + 30'a kadar, gecikenler dahil); tutar 0 → üçü de "yok"."""
    if tutar <= 0:
        return {"%s:takvim:hareket:%s" % (K, h): "yok", "%s:vadeTakip:hareket:%s" % (K, h): "yok", "%s:projeksiyon:hareket:%s" % (K, h): "yok"}
    g = gun(tarih)
    assert g <= 6
    return {"%s:takvim:hareket:%s" % (K, h): {"amount": tutar, "dueDate": tarih, "direction": yon, "label": "Tahsil Edilecek Borç" if yon == "in" else "Ödenecek Borç",
                                             "state": "overdue" if g < 0 else "today" if g == 0 else "upcoming", "days": g, "cari": c, "person": ISIM[c]},
            "%s:vadeTakip:hareket:%s" % (K, h): {"amount": tutar, "date": tarih, "direction": yon},
            "%s:projeksiyon:hareket:%s" % (K, h): {"amount": tutar, "date": tarih, "direction": yon}}


def fkalem(f, tutar):
    return {"%s:takvim:fatura:%s" % (K, f): {"amount": tutar, "direction": "in"} if tutar > 0 else "yok"}


def toplam(c, v, bakiye=None, R=None):
    """görünüm toplamı (takvim / Vade Takip / projeksiyon — bütün kalemler geçmişte, pencere içi). NOT (4): Σ = bakiye − R (R kalemleri aşarsa 0) — assert."""
    if bakiye is not None:
        assert v == max(0, bakiye - R), (c, v, bakiye, R)
    return {"%s:%s:cariToplam:%s" % (K, g, c): v for g in ("takvim", "vadeTakip", "projeksiyon")}


def bak(c, v):
    return {"%s:cari:%s:bakiye" % (K, c): v}


def supheli_yok(c):
    """şüpheli kayıtlı caride gecikmiş (C13.5 — SK-29) ve KS8.1 açık toplamı yazılmaz (değişmedi)"""
    return ["%s:cari:%s:gecikmis" % (K, c), "%s:cari:%s:acikToplam" % (K, c), "%s:cari:%s:acikEsitBakiye" % (K, c)]


def kart(no, toplam_, odenen, taksitler, mevcut=True):
    b = {"%s:kart:%s:var" % (K, no): True, "%s:kart:%s:toplam" % (K, no): toplam_, "%s:kart:%s:odenen" % (K, no): odenen, "%s:kart:%s:kalan" % (K, no): toplam_ - odenen,
         "%s:kart:%s:mevcutBorc" % (K, no): mevcut}
    assert sum(taksitler) == odenen
    for i, v in enumerate(taksitler):
        b["%s:kart:%s:taksit%d:odenen" % (K, no, i + 1)] = v
    return b


# ════════════════════════════ d39 — S130 değer alanı + S129
adim, bek, yok, belirsiz = [], {}, [], []
sayac = 0  # takvim:cariKalemSayisi — görünen tutarı > 0 hareket kalemleri (fatura kalemleri sayaçta yok)


def cari(c, isim, **ek):
    ISIM[c] = isim
    return ca(c, isim, **ek)


# N1 — S130'un örneği AYNEN (c7 düzeni): 01.05 Açılış 1.000 (vade 31.05) · 20.05 fatura N1F 800 · 25.05 Borç 500 (vade 12.06) · 05.06 stok Satış İadesi 600 (en eskiden: N1F'nin 600'ü — vade sırası
#   N1F 20.05 → Açılış 31.05 → Borç 12.06) · 08.06 Şüpheli Alacağa Al 900. Bakiye 1.000 + 800 + 500 − 600 = 1.700 (değişmez). R = 900: kuyruk N1F 200 → 0, Açılış 1.000 → 300, Borç 500.
#   ⇒ Açılış kalemi 300, fatura kalemi YOK, Borç 500 (kararın sonucu). Kalan Açılış 1.000 / Borç 500 ve N1F açığı 200 DEĞİŞMEZ (defter — Y14-1). Toplam 800 = 1.700 − 900.
adim += [cari("N1", "Nail Örnek", tarih="2026-05-01", acilis="1000", acilisVade="2026-05-31"), fat("n1f", "N1F", "N1", "800", "2026-05-20"),
         borc("n1b", "N1", "500", "2026-05-25", "2026-06-12"), {"id": "n1i", "islem": "stok_iade", "cari": "N1", "tutar": "600", "tarih": "2026-06-05"},
         sup("n1s", "SN1", "N1", "900", "2026-06-08")]
bek.update(bak("N1", 170000))
bek.update({"k1:hareket:acilis:N1:kalan": 100000, "k1:hareket:acilis:N1:vade": "2026-05-31", "k1:hareket:n1b:kalan": 50000, "k1:hareket:n1b:vade": "2026-06-12", "k1:fatura:N1F:acik": 20000})
bek.update(kalem("N1", "acilis:N1", 30000, "2026-05-31"))
bek.update(kalem("N1", "n1b", 50000, "2026-06-12"))
bek.update(fkalem("N1F", 0))
bek.update(toplam("N1", 80000, 170000, 90000))
yok += supheli_yok("N1")
sayac += 2

# N1b — N1 + 09.06 Değersiz 900 (Y14-7): R = 0; Değersiz bağsız kapatıcı (en eskiden, kendi gününde): N1F 200 → 0, Açılış 1.000 → 300 ⇒ kalemler N1 ile AYNI (Açılış 300, fatura yok, Borç 500);
#   Kalan Açılış 300, N1F açığı 0; bakiye 800. Toplam 800 = bakiye (R = 0).
adim += [cari("N1b", "Nail Değersiz", tarih="2026-05-01", acilis="1000", acilisVade="2026-05-31"), fat("n1bf", "N1bF", "N1b", "800", "2026-05-20"),
         borc("n1bb", "N1b", "500", "2026-05-25", "2026-06-12"), {"id": "n1bi", "islem": "stok_iade", "cari": "N1b", "tutar": "600", "tarih": "2026-06-05"},
         sup("n1bs", "SN1b", "N1b", "900", "2026-06-08"), deg("n1bd", "SN1b", "900", "2026-06-09")]
bek.update(bak("N1b", 80000))
bek.update({"k1:hareket:acilis:N1b:kalan": 30000, "k1:hareket:n1bb:kalan": 50000, "k1:fatura:N1bF:acik": 0})
bek.update(kalem("N1b", "acilis:N1b", 30000, "2026-05-31"))
bek.update(kalem("N1b", "n1bb", 50000, "2026-06-12"))
bek.update(fkalem("N1bF", 0))
bek.update(toplam("N1b", 80000, 80000, 0))
yok += supheli_yok("N1b")
sayac += 2


def ikili(c, isim):
    """02.06 fatura <c>F 400 (vadesiz) · 03.06 Borç x 300 (vadesiz — kalem günü kayıt günü, C16.1): kuyruk sırası F → x"""
    lo = c.lower()
    return [cari(c, isim, tarih="2026-06-01"), fat(lo + "f", c + "F", c, "400", "2026-06-02"), borc(lo + "x", c, "300", "2026-06-03")]


def ikili_bek(c, bakiye, F_acik, x_kalan, F_gor, x_gor, R):
    lo = c.lower()
    global sayac
    bek.update(bak(c, bakiye))
    bek.update({"k1:hareket:%sx:kalan" % lo: x_kalan, "k1:hareket:%sx:vade" % lo: "", "k1:fatura:%sF:acik" % c: F_acik})
    bek.update(kalem(c, lo + "x", x_gor, "2026-06-03"))
    bek.update(fkalem(c + "F", F_gor))
    bek.update(toplam(c, F_gor + x_gor, bakiye, R))
    yok.extend(supheli_yok(c))
    sayac += 1 if x_gor > 0 else 0


# N2 — şüpheli tutar ilk kalemi TAM bitirir: 05.06 Şüpheli 400 ⇒ F kalemi yok, x 300. Bakiye 700; Kalan x 300, F açığı 400.
adim += ikili("N2", "Nur Tam Biter") + [sup("n2s", "SN2", "N2", "400", "2026-06-05")]
ikili_bek("N2", 70000, 40000, 30000, 0, 30000, 40000)
# N3 — aşıp ikinciye geçer: Şüpheli 500 ⇒ F yok, x 200.
adim += ikili("N3", "Nuri Aşar") + [sup("n3s", "SN3", "N3", "500", "2026-06-05")]
ikili_bek("N3", 70000, 40000, 30000, 0, 20000, 50000)
# N4 — bütün kalemleri bitirir: Şüpheli 700 ⇒ F yok, x yok; toplam 0 = 700 − 700.
adim += ikili("N4", "Nesrin Hepsi") + [sup("n4s", "SN4", "N4", "700", "2026-06-05")]
ikili_bek("N4", 70000, 40000, 30000, 0, 0, 70000)
# N5 — N3 + 06.06 Değersiz 500 (tam): R 0; Değersiz en eskiden: F 400 → 0, x 300 → 200 ⇒ görünüm N3 ile AYNI (F yok, x 200); Kalan x 200, F açığı 0, bakiye 200.
adim += ikili("N5", "Necla Değersiz Tam") + [sup("n5s", "SN5", "N5", "500", "2026-06-05"), deg("n5d", "SN5", "500", "2026-06-06")]
ikili_bek("N5", 20000, 0, 20000, 0, 20000, 0)
# N6 — N3 + 06.06 Değersiz 200 (kısmen; NOT (3)): R 300; Değersiz 200 en eskiden: F 200, x 300 (defter); R 300: F 0, x 200 ⇒ F yok, x 200. Bakiye 500; Kalan x 300, F açığı 200. İki okuma aynı (Y14-5).
adim += ikili("N6", "Necmi Değersiz Kısmi") + [sup("n6s", "SN6", "N6", "500", "2026-06-05"), deg("n6d", "SN6", "200", "2026-06-06")]
ikili_bek("N6", 50000, 20000, 30000, 0, 20000, 30000)
# N7 — N3 + 06.06 tahsilat 200 (şüpheliden düşer — kalan 300; NOT (3) kısmen tahsil): defter F 200, x 300; R 300 ⇒ F yok, x 200. Bakiye 500.
adim += ikili("N7", "Nermin Kısmi Tahsil") + [sup("n7s", "SN7", "N7", "500", "2026-06-05"), tah("n7t", "N7", "200", "2026-06-06")]
ikili_bek("N7", 50000, 20000, 30000, 0, 20000, 30000)
# N8 — Şüpheli 300 + 06.06 tahsilat 500 (300'ü şüpheliden düşer, 200'ü normal): R 0; defter F 0, x 200 ⇒ F yok, x 200. Bakiye 200.
adim += ikili("N8", "Neşe Fazla Tahsil") + [sup("n8s", "SN8", "N8", "300", "2026-06-05"), tah("n8t", "N8", "500", "2026-06-06")]
ikili_bek("N8", 20000, 0, 20000, 0, 20000, 0)

# N10 — şüpheliden SONRA doğan kalem sırada SONRA (Y14-5 değer): 01.06 Borç x 600 (vadesiz) · 05.06 Şüpheli 400 · 08.06 fatura N10F 300 (vadesiz). Kuyruk sırası x (01.06) → F (08.06):
#   R 400 ⇒ x 200, F 300 — "şüphelinin günü" okumasıyla da aynı. Bakiye 900; Kalan x 600, F açığı 300; toplam 500.
adim += [cari("N10", "Nazlı Sonra Doğan", tarih="2026-06-01"), borc("n10x", "N10", "600", "2026-06-01"), sup("n10s", "SN10", "N10", "400", "2026-06-05"),
         fat("n10f", "N10F", "N10", "300", "2026-06-08")]
bek.update(bak("N10", 90000))
bek.update({"k1:hareket:n10x:kalan": 60000, "k1:fatura:N10F:acik": 30000})
bek.update(kalem("N10", "n10x", 20000, "2026-06-01"))
bek.update(fkalem("N10F", 30000))
bek.update(toplam("N10", 50000, 90000, 40000))
yok += supheli_yok("N10")
sayac += 1

# N11 — şüpheli kalan kalemleri AŞAR (Y14-4): 01.06 Borç x 500 · 05.06 Şüpheli 500 · SONRA girilen 04.06 tarihli tahsilat 300 (kayıttan önce tarihli — şüpheliden düşmez; R 500).
#   Defter x 200; R 500 > 200 ⇒ x kalemi yok; toplam 0 (bakiye 200 − R 500 < 0 → 0). Kalan x 200.
adim += [cari("N11", "Necdet Geriye Tarihli", tarih="2026-06-01"), borc("n11x", "N11", "500", "2026-06-01"), sup("n11s", "SN11", "N11", "500", "2026-06-05"),
         tah("n11t", "N11", "300", "2026-06-04")]
bek.update(bak("N11", 20000))
bek.update({"k1:hareket:n11x:kalan": 20000})
bek.update(kalem("N11", "n11x", 0, "2026-06-01"))
bek.update(toplam("N11", 0, 20000, 50000))
yok += supheli_yok("N11")

# N12 — iki şüpheli kaydı: 01.06 Borç x 500 · 02.06 Borç y 400 · 05.06 Şüpheli 300 · 06.06 Şüpheli 200 ⇒ R 500: x yok, y 400. Bakiye 900.
adim += [cari("N12", "Nevin İki Kayıt", tarih="2026-06-01"), borc("n12x", "N12", "500", "2026-06-01"), borc("n12y", "N12", "400", "2026-06-02"),
         sup("n12s1", "SN12a", "N12", "300", "2026-06-05"), sup("n12s2", "SN12b", "N12", "200", "2026-06-06")]
bek.update(bak("N12", 90000))
bek.update({"k1:hareket:n12x:kalan": 50000, "k1:hareket:n12y:kalan": 40000})
bek.update(kalem("N12", "n12x", 0, "2026-06-01"))
bek.update(kalem("N12", "n12y", 40000, "2026-06-02"))
bek.update(toplam("N12", 40000, 90000, 50000))
yok += supheli_yok("N12")
sayac += 1

# N13a / N13b — aynı adlı iki cari: N13a 01.06 Borç 500 + 05.06 Şüpheli 200 ⇒ kalem 300; N13b (aynı ad, başka telefon) 01.06 Borç 500, şüphelisiz ⇒ kalem 500 (değişmez),
#   gecikmiş 500 (vadesiz kalem 01.06 < bugün), açık toplamı 500 = bakiye.
adim += [cari("N13a", "Aynı Nail", tarih="2026-06-01"), borc("n13ax", "N13a", "500", "2026-06-01"), sup("n13as", "SN13a", "N13a", "200", "2026-06-05"),
         cari("N13b", "Aynı Nail", tarih="2026-06-01", tel="05550000013"), borc("n13bx", "N13b", "500", "2026-06-01")]
bek.update(bak("N13a", 50000))
bek.update({"k1:hareket:n13ax:kalan": 50000})
bek.update(kalem("N13a", "n13ax", 30000, "2026-06-01"))
bek.update(toplam("N13a", 30000, 50000, 20000))
yok += supheli_yok("N13a")
bek.update(bak("N13b", 50000))
bek.update({"k1:hareket:n13bx:kalan": 50000, "k1:cari:N13b:gecikmis": 50000, "k1:cari:N13b:acikToplam": 50000, "k1:cari:N13b:acikEsitBakiye": True})
bek.update(kalem("N13b", "n13bx", 50000, "2026-06-01"))
bek.update(toplam("N13b", 50000))
sayac += 2

# P1 — S129'un 1. örneği: 01.03 Borç x 900 · 15.03 Taksitler'den kart 900 (3 × 300: 01.04 / 01.05 / 01.06; kart x'i içine alır — O = T) · 10.04 karta BAĞLANMADAN tahsilat 500 (S50: taksit 1 300,
#   taksit 2'nin 200'ü) ⇒ Tahsil Edilen 500 · Kalan 400; taksit "Ödenen" 300 / 200 / 0; bakiye 400. x'in Kalan'ı (C13.4 (7)) 0 + 900 − 500 = 400; takvim kalemi yok (kuyruk 0; kapsam 400).
#   gecikmiş = taksit 2'nin 100'ü + taksit 3 300 = 400 (hepsinin vadesi geçmiş; C16.4).
adim += [cari("P1", "Pelin Kart Bağsız"), borc("p1x", "P1", "900", "2026-03-01"), kart_ac("kp1", "KP1", "P1", "900", 3, "2026-04-01", "2026-03-15"), tah("p1t", "P1", "500", "2026-04-10")]
bek.update(bak("P1", 40000))
bek.update(kart("KP1", 90000, 50000, [30000, 20000, 0]))
bek.update({"k1:hareket:p1x:kalan": 40000, "k1:cari:P1:gecikmis": 40000})
bek.update(kalem("P1", "p1x", 0, "2026-03-01"))
# P2 — S129'un 2. örneği: Borç 600 · kart 600 (2 × 300: 01.04 / 01.05) · 10.04 bağsız tahsilat 800 ⇒ Tahsil Edilen 600 · Kalan 0 (kartın tamamı ödendi — "Tamamlandı"; durum anahtarı kâhinde yok);
#   taksitler 300 / 300; avans 200; bakiye −200; x'in Kalan'ı 0; gecikmiş 0 (bize alacaklı).
adim += [cari("P2", "Pervin Fazla Ödeme"), borc("p2x", "P2", "600", "2026-03-01"), kart_ac("kp2", "KP2", "P2", "600", 2, "2026-04-01", "2026-03-15"), tah("p2t", "P2", "800", "2026-04-10")]
bek.update(bak("P2", -20000))
bek.update(kart("KP2", 60000, 60000, [30000, 30000]))
bek.update({"k1:hareket:p2x:kalan": 0, "k1:cari:P2:gecikmis": 0})
bek.update(kalem("P2", "p2x", 0, "2026-03-01"))
# P3 — S129 örneği Yeni Borç kartıyla (kart borcun kaynağı — C13.4 (6)): 15.03 Yeni Borç kartı 900 (3 × 300) · 10.04 bağsız tahsilat 500 ⇒ ödenen 500 · kalan 400; 300 / 200 / 0; bakiye 400;
#   gecikmiş 400.
adim += [cari("P3", "Pakize Yeni Borç"), kart_ac("kp3", "KP3", "P3", "900", 3, "2026-04-01", "2026-03-15", mevcut=False), tah("p3t", "P3", "500", "2026-04-10")]
bek.update(bak("P3", 40000))
bek.update(kart("KP3", 90000, 50000, [30000, 20000, 0], mevcut=False))
bek.update({"k1:cari:P3:gecikmis": 40000})

bek.update({"k1:takvim:cariKalemSayisi": sayac, "k1:projeksiyon:cari": sayac})
ad = "d39-c5-s130-supheli-kalemleri"
s = {"dil": DIL, "bugun": BUGUN,
     "aciklama": "Bakım 14 (S130 = A): Şüpheli Alacağa alınmış, Değersiz yazılmamış, tahsil edilmemiş tutar 'Tahsil Edilecek' kalemlerinden (takvim / Vade Takip / projeksiyon) tek yükümlülük"
                 " kuyruğunun sırasıyla en eskiden düşer; bakiye, Kalan, fatura açığı değişmez — kararın örneği (N1), Değersiz sonrası (N1b), ilk kalemi tam bitirir (N2) / aşar (N3) / hepsini bitirir"
                 " (N4), tam / kısmen Değersiz (N5 / N6), kısmen tahsilat (N7), tahsilat şüpheliyi aşar (N8), sonradan doğan kalem sırada sonra (N10), şüpheli kalan kalemleri aşar (N11), iki şüpheli"
                 " kaydı (N12), aynı adlı iki cari (N13a / N13b); S129 = A onayı: kart göstergeleri tek kuyruktan (P1 / P2 — kararın iki örneği; P3 Yeni Borç kartı)",
     "dayanak": "KARARLAR.md §25 (S130 A; Y14-1 … Y14-9; S129 A — Y14-10), §8 (K6.3, KS7, ŞÜPHELİ KALAN), §13 C13.4 / C13.5, §16 C16.1 / C16.4",
     "elleBeklenen": bek, "elleYok": yok, "elleBelirsiz": belirsiz, "adimlar": adim + [KONTROL], "ad": ad}
bicim.yaz(os.path.join(D, ad + ".json"), s)
print("%s: %d elle denetim (%d değer + %d yok + %d belirsiz)" % (ad, len(bek) + len(yok) + len(belirsiz), len(bek), len(yok), len(belirsiz)))

# ════════════════════════════ d40 — SUS alanları ve BİLİNEN SINIRLAR
adim, bek, yok, belirsiz = [], {}, [], []


def sus130(c, kalemler, faturalar, parcalar):
    """S130 görünümü SUS: kalem / fatura kalemi / görünüm toplamı / gecikmiş yazılmaz; `belirsiz`'de neden"""
    yok.extend(["%s:takvim:hareket:%s" % (K, h) for h in kalemler] + ["%s:vadeTakip:hareket:%s" % (K, h) for h in kalemler]
               + ["%s:projeksiyon:hareket:%s" % (K, h) for h in kalemler] + ["%s:takvim:fatura:%s" % (K, f) for f in faturalar]
               + ["%s:takvim:cariToplam:%s" % (K, c), "%s:cari:%s:gecikmis" % (K, c)])
    belirsiz.append(["cari %s S130 görünümü tanımsız" % c] + parcalar)


# Q1 — SK-28 (a): 01.06 Borç x 600 (vade 30.06) · 05.06 Şüpheli 400 · 08.06 fatura Q1F 300 (vadesiz; sırada x'ten önce). "Kontrol anı": F yok, x 500 ↔ "şüphelinin günü": x 200, F 300 ⇒ SUS.
#   Yazılan: bakiye 900, Kalan x 600, vade, F açığı 300.
adim += [cari("Q1", "Kadir Sonra Doğan", tarih="2026-06-01"), borc("q1x", "Q1", "600", "2026-06-01", "2026-06-30"), sup("q1s", "SQ1", "Q1", "400", "2026-06-05"),
         fat("q1f", "Q1F", "Q1", "300", "2026-06-08")]
bek.update(bak("Q1", 90000))
bek.update({"k1:hareket:q1x:kalan": 60000, "k1:hareket:q1x:vade": "2026-06-30", "k1:fatura:Q1F:acik": 30000})
sus130("Q1", ["q1x"], ["Q1F"], ["SK-28 (a)", "KULLANICIYA SORULMALI"])
# Q1b — Q1 + 10.06 tahsilat 200 (şüpheliden düşer; R 200): defter F 100, x 600; "kontrol anı" F yok, x 500 ↔ "şüphelinin günü" x 200, F 300 ⇒ SUS. Bakiye 700.
adim += [cari("Q1b", "Kadir Tahsilatlı", tarih="2026-06-01"), borc("q1bx", "Q1b", "600", "2026-06-01", "2026-06-30"), sup("q1bs", "SQ1b", "Q1b", "400", "2026-06-05"),
         fat("q1bf", "Q1bF", "Q1b", "300", "2026-06-08"), tah("q1bt", "Q1b", "200", "2026-06-10")]
bek.update(bak("Q1b", 70000))
bek.update({"k1:hareket:q1bx:kalan": 60000, "k1:fatura:Q1bF:acik": 10000})
sus130("Q1b", ["q1bx"], ["Q1bF"], ["SK-28 (a)"])
# Q2 — SK-28 (b): 01.06 fatura Q2F 800 · 02.06 Borç x 500 · 05.06 Şüpheli 900 · 08.06 Q2F'ye bağlı çek 300 (şüpheliden düşer — §3.11b) ⇒ SUS. Bakiye 1.000; Kalan x 500; F açığı 500 (bağ).
adim += [cari("Q2", "Kamil Bağlı Çek", tarih="2026-06-01"), fat("q2f", "Q2F", "Q2", "800", "2026-06-01"), borc("q2x", "Q2", "500", "2026-06-02"), sup("q2s", "SQ2", "Q2", "900", "2026-06-05"),
         {"id": "q2e", "islem": "evrak", "ad": "EQ2", "cari": "Q2", "tur": "cek", "tutar": "300", "tarih": "2026-06-08", "fatura": "Q2F"}]
bek.update(bak("Q2", 100000))
bek.update({"k1:hareket:q2x:kalan": 50000, "k1:fatura:Q2F:acik": 50000})
sus130("Q2", ["q2x"], ["Q2F"], ["SK-28 (b)"])
# Q3 — SK-27 (taksit kartı): 01.04 Borç x 400 · 15.04 kart 400 (2 × 200: 01.05 / 01.06; O = T) · 10.05 fatura Q3F 600 · 20.05 Şüpheli 300 ⇒ SUS. Kart göstergeleri DEĞİŞMEZ (ödenen 0, kalan 400).
#   Bakiye 1.000; F açığı 600.
adim += [cari("Q3", "Kerem Kartlı", tarih="2026-04-01"), borc("q3x", "Q3", "400", "2026-04-01"), kart_ac("kq3", "KQ3", "Q3", "400", 2, "2026-05-01", "2026-04-15"),
         fat("q3f", "Q3F", "Q3", "600", "2026-05-10"), sup("q3s", "SQ3", "Q3", "300", "2026-05-20")]
bek.update(bak("Q3", 100000))
bek.update(kart("KQ3", 40000, 0, [0, 0]))
bek.update({"k1:fatura:Q3F:acik": 60000})
sus130("Q3", ["q3x"], ["Q3F"], ["SK-27"])
# Q4 — SK-27 (verilen avans): 01.06 Borç x 500 · 02.06 müşteriye Ödeme 200 (verilen avans — S96 kalem) · 05.06 Şüpheli 300 ⇒ SUS (avans kalemi de yazılmaz). Bakiye 700.
adim += [cari("Q4", "Kenan Avanslı", tarih="2026-06-01"), borc("q4x", "Q4", "500", "2026-06-01"), {"id": "q4o", "islem": "odeme", "cari": "Q4", "tutar": "200", "tarih": "2026-06-02"},
         sup("q4s", "SQ4", "Q4", "300", "2026-06-05")]
bek.update(bak("Q4", 70000))
yok += ["k1:takvim:hareket:q4o", "k1:vadeTakip:hareket:q4o", "k1:projeksiyon:hareket:q4o"]
sus130("Q4", ["q4x"], [], ["SK-27"])

# Q5 — S133 = C (SUS): 01.03 Borç x 500 (vade 31.07 — ileride) · 02.03 stoktan veresiye satış 500 (vadesiz; carinin EN SON stok satışı) · 15.03 Taksitler'den kart 500 (açık borç 1.000 > 500 — S110
#   tetiği; TEK eşit elle borç x ↔ en son satış da 500) ⇒ SUS (C13.4 (11) düzeni: bakiye 1.000 ve kart tutarı yazılır).
adim += [cari("Q5", "Kevser Eşit Satış"), borc("q5x", "Q5", "500", "2026-03-01", "2026-07-31"), {"id": "q5s", "islem": "stok_satis_hesap", "cari": "Q5", "tutar": "500", "tarih": "2026-03-02"},
         kart_ac("kq5", "KQ5", "Q5", "500", 2, "2026-04-01", "2026-03-15")]
bek.update(bak("Q5", 100000))
bek.update({"k1:kart:KQ5:var": True, "k1:kart:KQ5:toplam": 50000})
yok += ["k1:cari:Q5:gecikmis", "k1:kart:KQ5:kalan", "k1:hareket:q5x:kalan", "k1:takvim:hareket:q5x"]
belirsiz.append(["cari Q5 tanımsız", "S133 = C", "BİLİNEN SINIR"])
# Q5b — S133'ün dışı (Y9-2 AYNEN): Borç x 500 (vade 31.07) · 02.03 stok satışı 500 · 03.03 stok satışı 300 (EN SON satış 300 ≠ 500) · kart 500 ⇒ kart TEK eşit elle borcu (x) içine alır.
#   Bakiye 1.300; kart ödenen 0 / kalan 500; x'in Kalan'ı 0 + 500 = 500, takvim kalemi yok (kuyruk 0 — S110 alanı Y8-4); gecikmiş = satış 500 + satış 300 + taksit 1 250 + taksit 2 250 = 1.300
#   (hepsinin vadesi geçmiş; x kartta).
adim += [cari("Q5b", "Kevser Son Satış Küçük"), borc("q5bx", "Q5b", "500", "2026-03-01", "2026-07-31"), {"id": "q5bs1", "islem": "stok_satis_hesap", "cari": "Q5b", "tutar": "500", "tarih": "2026-03-02"},
         {"id": "q5bs2", "islem": "stok_satis_hesap", "cari": "Q5b", "tutar": "300", "tarih": "2026-03-03"}, kart_ac("kq5b", "KQ5b", "Q5b", "500", 2, "2026-04-01", "2026-03-15")]
bek.update(bak("Q5b", 130000))
bek.update(kart("KQ5b", 50000, 0, [0, 0]))
bek.update({"k1:hareket:q5bx:kalan": 50000, "k1:takvim:hareket:q5bx": "yok", "k1:cari:Q5b:gecikmis": 130000})

# Q6 — S134 = C (SUS): 01.05 Borç 1.000 · 02.05 elle Alacak 300 (netleşir, net kalan 700) · 31.05 dönem kilidi · 05.06 tahsilat 1.000 ⇒ S95 (geri alınır: Borç 0, Alacak 300 açık) ↔ kilitli
#   netleşme kalır (Borç 0, avans 300) — ayrışıyor ⇒ net görünüm tanımsız; bakiye −300 yazılır.
adim += [cari("Q6", "Kâmil Kilitli"), borc("q6b", "Q6", "1000", "2026-05-01"), {"id": "q6a", "islem": "alacak", "cari": "Q6", "tutar": "300", "tarih": "2026-05-02"},
         {"id": "dk", "islem": "donem_kilitle", "tarih": "2026-05-31"}, tah("q6t", "Q6", "1000", "2026-06-05")]
bek.update(bak("Q6", -30000))
yok += ["k1:cari:Q6:gecikmis", "k1:hareket:q6b:kalan", "k1:hareket:q6a:kalan", "k1:takvim:hareket:q6a"]
belirsiz.append(["cari Q6 net görünüm tanımsız", "S134 = C", "BİLİNEN SINIR"])
# Q7 — S134'ün dışı (netleşme kilitten SONRA — S95 AYNEN): 01.06 Borç 1.000 · 02.06 elle Alacak 300 · 05.06 tahsilat 1.000 ⇒ 02.06'daki netleşme 05.06'daki ödemeyle geri alınır: Borç Kalan 0,
#   Alacak Kalan 300 — takvimde "Ödenecek Borç" 300 (02.06, gecikmiş −13). Bakiye −300.
adim += [cari("Q7", "Kâzım Kilitsiz", tarih="2026-06-01"), borc("q7b", "Q7", "1000", "2026-06-01"), {"id": "q7a", "islem": "alacak", "cari": "Q7", "tutar": "300", "tarih": "2026-06-02"},
         tah("q7t", "Q7", "1000", "2026-06-05")]
bek.update(bak("Q7", -30000))
bek.update({"k1:hareket:q7b:kalan": 0, "k1:hareket:q7a:kalan": 30000})
bek.update({"k1:takvim:hareket:q7a": {"amount": 30000, "dueDate": "2026-06-02", "direction": "out", "label": "Ödenecek Borç", "state": "overdue", "days": -13, "cari": "Q7",
                                       "person": "Kâzım Kilitsiz"}})

# Q8 — S135 = C (SK-20 susması + S135 metni): 01.03 fatura Q8F 600 · 02.03 Borç x 300 · 03.03 taksitli fatura Q8B 300 (2 × 150: 03.03 / 03.04) · 15.03 Taksitler'den kart 900 · 10.04 karta 300.
#   Q8B'nin açık taksitleri sayılınca açık borç 1.200 > 900 (S120: elle borç 300 < 900 → SK-20); sayılmasa 900 = kart (S126) ⇒ SUS; bakiye 1.200 − 300 = 900, kart tutarı.
# dönem kilidi adımı (carisiz — G1 sıralamasında SINIR) Q8'in mart faturalarını haziran faturalarından sonraya bırakmasın: Q8 senaryonun BAŞINA
adim[0:0] = [cari("Q8", "Kudret Taksitli Fatura"), fat("q8f", "Q8F", "Q8", "600", "2026-03-01"), borc("q8x", "Q8", "300", "2026-03-02"),
         fat("q8bf", "Q8B", "Q8", "300", "2026-03-03", {"sayi": 2, "ilkVade": "2026-03-03"}), kart_ac("kq8", "KQ8", "Q8", "900", 3, "2026-04-01", "2026-03-15"),
         {"id": "q8k", "islem": "kart_tahsilat", "kayit": "KQ8", "tutar": "300", "tarih": "2026-04-10"}]
bek.update(bak("Q8", 90000))
bek.update({"k1:kart:KQ8:var": True, "k1:kart:KQ8:toplam": 90000})
yok += ["k1:cari:Q8:gecikmis", "k1:kart:KQ8:kalan", "k1:hareket:q8x:kalan", "k1:takvim:hareket:q8x"]
belirsiz.append(["cari Q8 tanımsız", "SK-20", "S123 = C", "S135 = C"])

ad = "d40-c5-s130-sus-bilinen-sinir"
s = {"dil": DIL, "bugun": BUGUN,
     "aciklama": "Bakım 14: S130'un SUS alanları — iki zaman okuması ayrışıyor (Q1, Q1b — SK-28 (a)), şüpheliden düşen bağlı çek (Q2 — SK-28 (b)), taksit kartı (Q3) ve verilen avans (Q4 — SK-27);"
                 " BİLİNEN SINIRLAR — S133 = C (Q5 SUS; Q5b en son satış karta eşit değil — Y9-2 değer), S134 = C (Q6 kilitli netleşme SUS; Q7 kilitten sonra — S95 değer), S135 = C (Q8 SK-20 + S135)",
     "dayanak": "KARARLAR.md §25 (Y14-5, Y14-6, Y14-11 … Y14-14), §21 (Y9-2, SK-20), §17 (S95), §16 (C16.2), §13 C13.4 (11)",
     "elleBeklenen": bek, "elleYok": yok, "elleBelirsiz": belirsiz, "adimlar": adim + [KONTROL], "ad": ad}
bicim.yaz(os.path.join(D, ad + ".json"), s)
print("%s: %d elle denetim (%d değer + %d yok + %d belirsiz)" % (ad, len(bek) + len(yok) + len(belirsiz), len(bek), len(yok), len(belirsiz)))
