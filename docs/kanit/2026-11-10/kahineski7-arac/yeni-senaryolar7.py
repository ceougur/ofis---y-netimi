#!/usr/bin/env python3
"""Bakım 7 elle senaryoları: d30 / d31 / d32 satışla birlikte açılan kartla (`stok_satis_taksit`) + elle yolun reddi (G2 (b)). Bütün beklenen değerler bu betikte ELLE — kâhin koşulmadan,
girdilerden ve KARARLAR.md §18 / §19'dan. Bakım 6'nın değerleri (kahineski6-arac/yeni-senaryolar.py) taşındığı yerde AYNEN yazıldı; değişenler rapordaki tabloda.
Kullanım: python3 -I yeni-senaryolar7.py <senaryolar klasörü>"""
import copy
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bicim  # noqa: E402

D = sys.argv[1]
DIL = "destekofis-cari/3"
KONTROL = {"id": "k1", "islem": "kontrol", "gecikmis": True, "gorunumToplam": True, "acikToplam": True}


def kalem(tutar, gun, yon, etiket, durum, gunler, cari, kisi):
    return {"amount": tutar, "dueDate": gun, "direction": yon, "label": etiket, "state": durum, "days": gunler, "cari": cari, "person": kisi}


def yok3(k, h):
    return {"%s:takvim:hareket:%s" % (k, h): "yok", "%s:vadeTakip:hareket:%s" % (k, h): "yok", "%s:projeksiyon:hareket:%s" % (k, h): "yok"}


def yaz(ad, bugun, aciklama, dayanak, adimlar, bek, yok=None, belirsiz=None):
    s = {"dil": DIL, "bugun": bugun, "aciklama": aciklama, "dayanak": dayanak, "elleBeklenen": bek}
    if yok:
        s["elleYok"] = yok
    if belirsiz:
        s["elleBelirsiz"] = belirsiz
    s["adimlar"] = adimlar + [KONTROL]
    s["ad"] = ad
    bicim.yaz(os.path.join(D, ad + ".json"), s)


def sk(id_, ad, cari, tutar, tarih, taksit=2, ilk="2026-06-01"):
    """bakım 7 Y7-2: stoktan veresiye satış + aynı işlemde o satışın taksit kartı"""
    return {"id": id_, "islem": "stok_satis_taksit", "ad": ad, "cari": cari, "tutar": tutar, "tarih": tarih, "taksit": taksit, "ilkVade": ilk}


def elle_kart(id_, ad, cari, tutar, tarih, taksit=2, ilk="2026-06-01"):
    return {"id": id_, "islem": "kart_ac", "ad": ad, "cari": cari, "tutar": tutar, "taksit": taksit, "ilkVade": ilk, "tarih": tarih, "mevcut": True}


# ─────────────────────────── d30 / d31 / d32 — S101 A satışla birlikte açılan kartla (G2 (a)); d30'da elle yolun reddi (G2 (b))
Q = [
    # Q2 kısmen avansla kapanmış satışa kart: avans 400 → satış + kart 600 (2 × 300; 01.06 / 01.07): 1. taksit 300 + 2. taksitin 100'ü avansla ödenmiş, 2. taksit 200 açık
    {"id": "cq2", "islem": "cari_ac", "ad": "Q2", "isim": "Kısmi Bitti", "tarih": "2026-04-01"},
    {"id": "q2t", "islem": "tahsilat", "cari": "Q2", "tutar": "400", "tarih": "2026-05-01"},
    sk("kq2", "KQ2", "Q2", "600", "2026-05-05"),
    # Q4 kısmen avanslı + kart tahsilatı açık kısmı AŞMIYOR (100 < 200): 2. taksit 100 açık
    {"id": "cq4", "islem": "cari_ac", "ad": "Q4", "isim": "Aşmayan Taksit", "tarih": "2026-04-01"},
    {"id": "q4t", "islem": "tahsilat", "cari": "Q4", "tutar": "400", "tarih": "2026-05-01"},
    sk("kq4", "KQ4", "Q4", "600", "2026-05-05"),
    {"id": "q4k", "islem": "kart_tahsilat", "kayit": "KQ4", "tutar": "100", "tarih": "2026-05-20"},
]
Q_EK = [
    # Q1 S101'in örneği: 1.000 avans → stoktan 600 veresiye satış + 2 taksit → Taksit Tahsilatı 300 → Borç Yaz 500 ⇒ kart Bitti, takvim / zil boş, gecikmiş 0, müşteri 200 alacaklı
    {"id": "cq1", "islem": "cari_ac", "ad": "Q1", "isim": "Kemal Bitti", "tarih": "2026-04-01"},
    {"id": "q1t", "islem": "tahsilat", "cari": "Q1", "tutar": "1000", "tarih": "2026-05-01"},
    sk("kq1", "KQ1", "Q1", "600", "2026-05-05"),
    {"id": "q1k", "islem": "kart_tahsilat", "kayit": "KQ1", "tutar": "300", "tarih": "2026-05-10"},
    {"id": "q1b", "islem": "borc", "cari": "Q1", "tutar": "500", "tarih": "2026-05-12"},
    # Q3 kısmen avanslı + kart tahsilatı açık kısmı AŞIYOR (500 > 200): kart Bitti, fazlası 300 avans
    {"id": "cq3", "islem": "cari_ac", "ad": "Q3", "isim": "Aşan Taksit", "tarih": "2026-04-01"},
    {"id": "q3t", "islem": "tahsilat", "cari": "Q3", "tutar": "400", "tarih": "2026-05-01"},
    sk("kq3", "KQ3", "Q3", "600", "2026-05-05"),
    {"id": "q3k", "islem": "kart_tahsilat", "kayit": "KQ3", "tutar": "500", "tarih": "2026-05-20"},
    # Q5 SK-14: Bitti karttan sonra vadeleri doğum sırasına uymayan iki borç, sonra Taksit Tahsilatı — iki okuma ayrışır, kâhin susar
    {"id": "cq5", "islem": "cari_ac", "ad": "Q5", "isim": "Ayrışan Kart", "tarih": "2026-04-01"},
    {"id": "q5t", "islem": "tahsilat", "cari": "Q5", "tutar": "1000", "tarih": "2026-05-01"},
    sk("kq5", "KQ5", "Q5", "600", "2026-05-05"),
    {"id": "q5x", "islem": "borc", "cari": "Q5", "tutar": "500", "tarih": "2026-05-06", "vade": "2026-06-30"},
    {"id": "q5y", "islem": "borc", "cari": "Q5", "tutar": "300", "tarih": "2026-05-07", "vade": "2026-05-08"},
    {"id": "q5k", "islem": "kart_tahsilat", "kayit": "KQ5", "tutar": "300", "tarih": "2026-05-20"},
    # Q6 (bakım 6: kart > açık + avanslı kısım — satışla açılan kartta KURULAMAZ, kart = satış): ELLE yol — borç tamamen avansla kapanmış, kart 1.000 > satış → RET
    {"id": "cq6", "islem": "cari_ac", "ad": "Q6", "isim": "Büyük Kart", "tarih": "2026-04-01"},
    {"id": "q6t", "islem": "tahsilat", "cari": "Q6", "tutar": "1000", "tarih": "2026-05-01"},
    {"id": "q6s", "islem": "stok_satis_hesap", "cari": "Q6", "tutar": "600", "tarih": "2026-05-05"},
    elle_kart("kq6", "KQ6", "Q6", "1000", "2026-05-05"),
    # Q7 satış avansla DEĞİL iade alacağıyla kapanmış (müşterinin hesapta duran stok iadesi) — S101 kurulmaz (Y6-4 "AVANSLA"; EK-2B 32 tanımsızlığı aynen)
    {"id": "cq7", "islem": "cari_ac", "ad": "Q7", "isim": "İadeli Kart", "tarih": "2026-04-01"},
    {"id": "q7i", "islem": "stok_iade", "cari": "Q7", "tutar": "600", "tarih": "2026-05-03"},
    sk("kq7", "KQ7", "Q7", "600", "2026-05-05"),
    # Q8 aynı adlı iki cari: birinin avansı öbürünün kartını kapatmaz
    {"id": "cq8a", "islem": "cari_ac", "ad": "Q8a", "isim": "Aynı Kart", "tarih": "2026-04-01"},
    {"id": "cq8b", "islem": "cari_ac", "ad": "Q8b", "isim": "Aynı Kart", "tarih": "2026-04-01", "tel": "05550000008"},
    {"id": "q8t", "islem": "tahsilat", "cari": "Q8a", "tutar": "600", "tarih": "2026-05-01"},
    sk("kq8", "KQ8", "Q8a", "600", "2026-05-05"),
    sk("kq8b", "KQ8B", "Q8b", "600", "2026-05-05"),
    # Q9 (bakım 7 Y7-2 (1)): iki satışla açılan kart — ikinci kart açılırken birincinin iki taksiti vadesi geçmiş açık; kart KENDİ satışını tüketir (birincinin taksitlerine dokunmaz)
    {"id": "cq9", "islem": "cari_ac", "ad": "Q9", "isim": "İki Taksitli", "tarih": "2026-03-01"},
    sk("kq9a", "KQ9A", "Q9", "400", "2026-04-01", ilk="2026-04-15"),
    sk("kq9b", "KQ9B", "Q9", "600", "2026-05-20"),
    # QR1 ELLE yolun reddi — borç tamamen avansla kapanmış (S101'in örneği elle kartla): kart RET, Taksit Tahsilatı RET (kart yok), Borç Yaz avanstan kapanır
    {"id": "cqr1", "islem": "cari_ac", "ad": "QR1", "isim": "Elle Bitti Yok", "tarih": "2026-04-01"},
    {"id": "qr1t", "islem": "tahsilat", "cari": "QR1", "tutar": "1000", "tarih": "2026-05-01"},
    {"id": "qr1s", "islem": "stok_satis_hesap", "cari": "QR1", "tutar": "600", "tarih": "2026-05-05"},
    elle_kart("kqr1", "KQR1", "QR1", "600", "2026-05-05"),
    {"id": "qr1k", "islem": "kart_tahsilat", "kayit": "KQR1", "tutar": "300", "tarih": "2026-05-10"},
    {"id": "qr1b", "islem": "borc", "cari": "QR1", "tutar": "500", "tarih": "2026-05-12"},
    # QR2 ELLE — kısmen kapanmış (açık 200), kart 600 > açık → RET
    {"id": "cqr2", "islem": "cari_ac", "ad": "QR2", "isim": "Elle Kısmi", "tarih": "2026-04-01"},
    {"id": "qr2t", "islem": "tahsilat", "cari": "QR2", "tutar": "400", "tarih": "2026-05-01"},
    {"id": "qr2s", "islem": "stok_satis_hesap", "cari": "QR2", "tutar": "600", "tarih": "2026-05-05"},
    elle_kart("kqr2", "KQR2", "QR2", "600", "2026-05-05"),
    # QR3 ELLE — kabul sınırı: kart = açık borç (200) → KABUL (2 × 100; 01.06 / 01.07)
    {"id": "cqr3", "islem": "cari_ac", "ad": "QR3", "isim": "Elle Sınır", "tarih": "2026-04-01"},
    {"id": "qr3t", "islem": "tahsilat", "cari": "QR3", "tutar": "400", "tarih": "2026-05-01"},
    {"id": "qr3s", "islem": "stok_satis_hesap", "cari": "QR3", "tutar": "600", "tarih": "2026-05-05"},
    elle_kart("kqr3", "KQR3", "QR3", "200", "2026-05-05"),
    # QR4 ELLE — sınır: kart açık borcu 1 kuruş aşıyor (200,01) → RET
    {"id": "cqr4", "islem": "cari_ac", "ad": "QR4", "isim": "Elle Sınır Aşan", "tarih": "2026-04-01"},
    {"id": "qr4t", "islem": "tahsilat", "cari": "QR4", "tutar": "400", "tarih": "2026-05-01"},
    {"id": "qr4s", "islem": "stok_satis_hesap", "cari": "QR4", "tutar": "600", "tarih": "2026-05-05"},
    elle_kart("kqr4", "KQR4", "QR4", "200,01", "2026-05-05"),
    # QR5 ELLE — borç stok iadesiyle kapanmış (taksitlendirilecek borç yok) → RET (bakım 6 Q7'nin elle hâli)
    {"id": "cqr5", "islem": "cari_ac", "ad": "QR5", "isim": "Elle İadeli", "tarih": "2026-04-01"},
    {"id": "qr5s", "islem": "stok_satis_hesap", "cari": "QR5", "tutar": "600", "tarih": "2026-05-05"},
    {"id": "qr5i", "islem": "stok_iade", "cari": "QR5", "tutar": "600", "tarih": "2026-05-06"},
    elle_kart("kqr5", "KQR5", "QR5", "600", "2026-05-07"),
    # QS SK-18: aynı kişide satış 600 + alış 300, elle kart 600 — kalem okuması kabul (açık satış 600), bakiye okuması ret (bakiye 300) → kâhin SUSAR (adım durumu yazılmaz)
    {"id": "cqs", "islem": "cari_ac", "ad": "QS", "isim": "Çift Yönlü Kartlı", "tarih": "2026-04-01"},
    {"id": "qsf", "islem": "fatura", "ad": "QSF", "cari": "QS", "tutar": "600", "tarih": "2026-05-01"},
    {"id": "qsa", "islem": "fatura", "ad": "QSA", "cari": "QS", "tur": "alis", "tutar": "300", "tarih": "2026-05-02"},
    elle_kart("kqs", "KQS", "QS", "600", "2026-05-05"),
]


def q_ortak(gec2, gec4):
    # bakım 6'dan AYNEN (q_ortak)
    return {
        "k1:kart:KQ2:toplam": 60000, "k1:kart:KQ2:odenen": 40000, "k1:kart:KQ2:kalan": 20000, "k1:kart:KQ2:taksit1:odenen": 30000, "k1:kart:KQ2:taksit2:odenen": 10000,
        "k1:cari:Q2:bakiye": 20000, "k1:cari:Q2:gecikmis": gec2,
        "k1:kart:KQ4:toplam": 60000, "k1:kart:KQ4:odenen": 50000, "k1:kart:KQ4:kalan": 10000, "k1:kart:KQ4:taksit1:odenen": 30000, "k1:kart:KQ4:taksit2:odenen": 20000,
        "k1:cari:Q4:bakiye": 10000, "k1:cari:Q4:gecikmis": gec4,
    }


def q_adim():
    # bakım 7: satışla açılan kart her durumda kabul (Y7-2 (4)); kartın türü yazılmaz
    return {"adim:kq2:durum": "ok", "adim:kq4:durum": "ok", "adim:q4k:durum": "ok", "k1:kart:KQ2:var": True, "k1:kart:KQ4:var": True}


bek30 = dict(q_ortak(0, 0))
bek30.update(q_adim())
bek30.update({
    # bakım 6'dan AYNEN (yalnız KQ1:mevcutBorc kalktı → elleYok)
    "k1:kart:KQ1:toplam": 60000, "k1:kart:KQ1:odenen": 60000, "k1:kart:KQ1:kalan": 0, "k1:kart:KQ1:taksit1:odenen": 30000, "k1:kart:KQ1:taksit2:odenen": 30000,
    "k1:hareket:q1b:kalan": 0, **yok3("k1", "q1b"), "k1:cari:Q1:bakiye": -20000, "k1:cari:Q1:gecikmis": 0, "k1:cari:Q1:acikToplam": 0, "k1:cari:Q1:acikEsitBakiye": False,
    "k1:kart:KQ3:odenen": 60000, "k1:kart:KQ3:kalan": 0, "k1:kart:KQ3:taksit1:odenen": 30000, "k1:kart:KQ3:taksit2:odenen": 30000, "k1:cari:Q3:bakiye": -30000, "k1:cari:Q3:gecikmis": 0,
    "k1:kart:KQ5:toplam": 60000, "k1:cari:Q5:bakiye": 10000,
    "k1:kart:KQ8:odenen": 60000, "k1:kart:KQ8:kalan": 0, "k1:cari:Q8a:bakiye": 0, "k1:cari:Q8a:gecikmis": 0,
    "k1:kart:KQ8B:odenen": 0, "k1:kart:KQ8B:kalan": 60000, "k1:kart:KQ8B:taksit1:odenen": 0, "k1:kart:KQ8B:taksit2:odenen": 0, "k1:cari:Q8b:bakiye": 60000, "k1:cari:Q8b:gecikmis": 30000,
    "adim:kq1:durum": "ok", "adim:q1k:durum": "ok", "adim:kq3:durum": "ok", "adim:q3k:durum": "ok", "adim:kq5:durum": "ok", "adim:kq8:durum": "ok", "adim:kq8b:durum": "ok",
    # Q6 (değişti): elle yol — RET; kart yok; bakiye aynı (−400), avans kalır, gecikmiş 0
    "adim:kq6:durum": "ret", "k1:cari:Q6:bakiye": -40000, "k1:cari:Q6:gecikmis": 0,
    # Q7 (değişti): satışla açılan kart iade alacağıyla kapanmış satışa — adım kabul, kart 600, bakiye 0; ödeneni tanımsız (EK-2B 32)
    "adim:kq7:durum": "ok", "k1:kart:KQ7:var": True, "k1:kart:KQ7:toplam": 60000, "k1:cari:Q7:bakiye": 0,
    # Q9 (yeni): iki kart kendi satışlarını tüketir — taksitlerin hiçbiri ödenmedi; gecikmiş = 15.04 200 + 15.05 200 + 01.06 300
    "adim:kq9a:durum": "ok", "adim:kq9b:durum": "ok",
    "k1:kart:KQ9A:toplam": 40000, "k1:kart:KQ9A:odenen": 0, "k1:kart:KQ9A:kalan": 40000, "k1:kart:KQ9A:taksit1:odenen": 0, "k1:kart:KQ9A:taksit2:odenen": 0,
    "k1:kart:KQ9B:toplam": 60000, "k1:kart:KQ9B:odenen": 0, "k1:kart:KQ9B:kalan": 60000, "k1:kart:KQ9B:taksit1:odenen": 0, "k1:kart:KQ9B:taksit2:odenen": 0,
    "k1:cari:Q9:bakiye": 100000, "k1:cari:Q9:gecikmis": 70000,
    # QR1 (yeni): elle kart RET, kart tahsilatı RET; Borç 500'ün 400'ü avanstan → Kalan 100, vadesiz → kayıt gününde kalem (S91), ertesi günden gecikmiş
    "adim:kqr1:durum": "ret", "adim:qr1k:durum": "ret", "adim:qr1b:durum": "ok", "k1:cari:QR1:bakiye": 10000, "k1:hareket:qr1b:kalan": 10000, "k1:cari:QR1:gecikmis": 10000,
    "k1:takvim:hareket:qr1b": kalem(10000, "2026-05-12", "in", "Tahsil Edilecek Borç", "overdue", -34, "QR1", "Elle Bitti Yok"),
    "k1:vadeTakip:hareket:qr1b": {"amount": 10000, "date": "2026-05-12", "direction": "in"}, "k1:projeksiyon:hareket:qr1b": {"amount": 10000, "date": "2026-05-12", "direction": "in"},
    # QR2 (yeni): elle kart 600 > açık 200 — RET; stok satışının 200'ü açık, vadesiz → gecikmiş 200
    "adim:kqr2:durum": "ret", "k1:cari:QR2:bakiye": 20000, "k1:cari:QR2:gecikmis": 20000,
    # QR3 (yeni): elle kart = açık 200 — KABUL; kart açık kısmı tüketir; taksitler 100 + 100, 1. taksit gecikmiş
    "adim:kqr3:durum": "ok", "k1:kart:KQR3:var": True, "k1:kart:KQR3:toplam": 20000, "k1:kart:KQR3:mevcutBorc": True, "k1:kart:KQR3:odenen": 0, "k1:kart:KQR3:kalan": 20000,
    "k1:kart:KQR3:taksit1:odenen": 0, "k1:kart:KQR3:taksit2:odenen": 0, "k1:cari:QR3:bakiye": 20000, "k1:cari:QR3:gecikmis": 10000,
    # QR4 (yeni): elle kart 200,01 > açık 200 — RET
    "adim:kqr4:durum": "ret", "k1:cari:QR4:bakiye": 20000, "k1:cari:QR4:gecikmis": 20000,
    # QR5 (yeni; bakım 6 Q7'nin elle hâli): borç stok iadesiyle kapanmış, taksitlendirilecek borç yok — RET
    "adim:kqr5:durum": "ret", "k1:cari:QR5:bakiye": 0, "k1:cari:QR5:gecikmis": 0,
    # QS (yeni): SK-18 — adım durumu yazılmaz; bakiye iki dünyada aynı
    "k1:cari:QS:bakiye": 30000,
})
yok30 = ["k1:kart:KQ5:odenen", "k1:kart:KQ5:kalan", "k1:hareket:q5x:kalan", "k1:hareket:q5y:kalan", "k1:cari:Q5:gecikmis",
         "k1:kart:KQ6:var", "k1:kart:KQ6:toplam", "k1:kart:KQ7:odenen", "k1:kart:KQ7:kalan", "k1:kart:KQ1:mevcutBorc", "k1:kart:KQ7:mevcutBorc", "k1:kart:KQ9A:mevcutBorc",
         "k1:kart:KQR1:var", "k1:kart:KQR1:toplam", "k1:kart:KQR2:var", "k1:kart:KQR2:toplam", "k1:kart:KQR4:var", "k1:kart:KQR4:toplam", "k1:kart:KQR5:var", "k1:kart:KQR5:toplam",
         "adim:kqs:durum", "k1:kart:KQS:var", "k1:kart:KQS:toplam", "k1:cari:QS:gecikmis",
         "k1:takvim:cariKalemSayisi", "k1:projeksiyon:cari"]
yaz("d30-c5-s101-bitti-kart", "2026-06-15",
    "2.5.0 bakım 7 C19 (BAŞ MİMAR KARARI 10.11 — G2; KULLANICI S101 = A, 10.11 18:22; bugün 15.06): S101 yalnız SATIŞLA BİRLİKTE açılan kartta (stoktan veresiye satış + aynı işlemde "
    "taksit — `stok_satis_taksit`): borç avansla zaten kapanmışken kart 'Bitti'; kartın tahsilatı avansa eklenir; sonraki borç avanstan kapanır. Q1 kararın örneği (kart Bitti, Borç 0, gecikmiş 0, "
    "müşteri 200 alacaklı). Q2 kısmen avanslı satışa kart. Q3 / Q4 kart tahsilatı açık kısmı aşıyor / aşmıyor. Q5 SK-14 (susar). Q7 satış iade alacağıyla kapanmış (S101 'AVANSLA' — kurulmaz). "
    "Q8 aynı adlı iki cari. Q9 iki satış kartı — kart kendi satışını tüketir. ELLE 'Carinin Mevcut Borcunu Taksitlendir' (G2 (b)): Q6 / QR1 borç tamamen avansla kapanmış → RET (QR1'de sonraki "
    "Taksit Tahsilatı da RET), QR2 kısmen kapanmış + kart açık kısımdan büyük → RET, QR3 kart = açık borç → KABUL, QR4 1 kuruş aşan → RET, QR5 borç iadeyle kapanmış → RET; QS SK-18 (kalem / "
    "bakiye okuması ayrışır — susar).",
    "KARARLAR.md §19 Y7-2, Y7-3, SK-18; §18 Y6-4, Y6-5, SK-14; S101 A, M1e, S99 A, 2B-S3 A", Q + Q_EK, bek30, yok=yok30,
    belirsiz=[["cari Q5 tanımsız", "SK-14"], ["cari Q7 tanımsız", "EK-2B 32"], ["adım kqs", "SK-18"]])
b31 = dict(q_ortak(0, 0))
b31.update(q_adim())
yaz("d31-c5-s101-taksit-vade-gunu", "2026-07-01",
    "d30'un Q2 / Q4'ü (satışla açılan kart), bugün 01.07 (2. taksitin VADE GÜNÜ — gecikmiş değil, M1f): gecikmiş 0 / 0; kart ödenenleri aynı.", "KARARLAR.md §19 Y7-2; §18 Y6-4; S101 A, M1f",
    copy.deepcopy(Q), b31, yok=["k1:kart:KQ2:mevcutBorc", "k1:kart:KQ4:mevcutBorc"])
b32 = dict(q_ortak(20000, 10000))
b32.update(q_adim())
yaz("d32-c5-s101-taksit-ertesi-gun", "2026-07-02",
    "d30'un Q2 / Q4'ü (satışla açılan kart), bugün 02.07 (GÜN DÖNÜMÜ — 2. taksit vadesinin ertesi): gecikmiş 200 / 100 (2. taksitlerin açık kısmı); kart ödenenleri aynı.",
    "KARARLAR.md §19 Y7-2; §18 Y6-4; S101 A, S1 A, M1f", copy.deepcopy(Q), b32, yok=["k1:kart:KQ2:mevcutBorc", "k1:kart:KQ4:mevcutBorc"])
print("d30–d32 yazıldı (bakım 7)")
