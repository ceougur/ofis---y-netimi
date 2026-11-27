#!/usr/bin/env python3
"""Bakım 6 elle senaryoları (d27–d33). Bütün beklenen değerler bu betikte ELLE — kâhin koşulmadan, karar metinlerinden (KARARLAR.md §18). Kullanım:
python3 -I yeni-senaryolar.py <senaryolar klasörü>"""
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


# ─────────────────────────── d27 / d28 / d29 — S99 A (taksitli fatura, tek kuyruk)
P = [
    # P1 S99'un örneği: avans 500 (01.05) → taksitli B 300 (3 × 100; 01.06 / 01.07 / 01.08) (05.05) → taksitsiz A 500 (10.05) ⇒ B 'Ödendi', A 300 açık
    {"id": "cp1", "islem": "cari_ac", "ad": "P1", "isim": "Pınar Örnek", "tarih": "2026-04-01"},
    {"id": "p1t", "islem": "tahsilat", "cari": "P1", "tutar": "500", "tarih": "2026-05-01"},
    {"id": "p1b", "islem": "fatura", "ad": "P1B", "cari": "P1", "tutar": "300", "tarih": "2026-05-05", "taksit": {"sayi": 3, "ilkVade": "2026-06-01"}},
    {"id": "p1a", "islem": "fatura", "ad": "P1A", "cari": "P1", "tutar": "500", "tarih": "2026-05-10"},
    # P2 taksitler farklı vadelerde, avans kısmen kapatır, aradaki vadeli Borç; sonra bağsız tahsilat vade sırasıyla (Borç 10.06 → 2. taksit 20.06 → 3. taksit 20.07)
    {"id": "cp2", "islem": "cari_ac", "ad": "P2", "isim": "Pelin Vadeler", "tarih": "2026-04-01"},
    {"id": "p2t", "islem": "tahsilat", "cari": "P2", "tutar": "400", "tarih": "2026-05-01"},
    {"id": "p2f", "islem": "fatura", "ad": "P2F", "cari": "P2", "tutar": "900", "tarih": "2026-05-02", "taksit": {"sayi": 3, "ilkVade": "2026-05-20"}},
    {"id": "p2b", "islem": "borc", "cari": "P2", "tutar": "200", "tarih": "2026-05-03", "vade": "2026-06-10"},
    {"id": "p2u", "islem": "tahsilat", "cari": "P2", "tutar": "300", "tarih": "2026-06-12"},
    # P3 verilen avans (S98) + taksitli fatura (S99): Ödeme 200 (01.05) · taksitli 600 (2 × 300; 01.06 / 01.07) (05.05) · tahsilat 300 (10.05) ⇒ önce avans (vade 01.05), sonra 1. taksit
    {"id": "cp3", "islem": "cari_ac", "ad": "P3", "isim": "Polat Avanslı", "tarih": "2026-04-01"},
    {"id": "p3o", "islem": "odeme", "cari": "P3", "tutar": "200", "tarih": "2026-05-01"},
    {"id": "p3f", "islem": "fatura", "ad": "P3F", "cari": "P3", "tutar": "600", "tarih": "2026-05-05", "taksit": {"sayi": 2, "ilkVade": "2026-06-01"}},
    {"id": "p3t", "islem": "tahsilat", "cari": "P3", "tutar": "300", "tarih": "2026-05-10"},
]
P_EK = [
    # P4 aynı adlı iki cari: birinin avansı öbürünün faturasına gitmez
    {"id": "cp4a", "islem": "cari_ac", "ad": "P4a", "isim": "Aynı Taksitçi", "tarih": "2026-04-01"},
    {"id": "cp4b", "islem": "cari_ac", "ad": "P4b", "isim": "Aynı Taksitçi", "tarih": "2026-04-01", "tel": "05550000004"},
    {"id": "p4t", "islem": "tahsilat", "cari": "P4a", "tutar": "1000", "tarih": "2026-05-01"},
    {"id": "p4f", "islem": "fatura", "ad": "P4F", "cari": "P4a", "tutar": "600", "tarih": "2026-05-05", "taksit": {"sayi": 2, "ilkVade": "2026-06-01"}},
    {"id": "p4g", "islem": "fatura", "ad": "P4G", "cari": "P4b", "tutar": "500", "tarih": "2026-05-06"},
    # P5 SK-15: taksitli satış + alış (karşı yönlü kalem) — kâhin susar (belge durumları, gecikmiş, net görünüm)
    {"id": "cp5", "islem": "cari_ac", "ad": "P5", "isim": "Çift Yönlü Taksit", "tarih": "2026-02-01"},
    {"id": "p5f", "islem": "fatura", "ad": "P5F", "cari": "P5", "tutar": "900", "tarih": "2026-03-01", "taksit": {"sayi": 3, "ilkVade": "2026-04-01"}},
    {"id": "p5a", "islem": "fatura", "ad": "P5A", "cari": "P5", "tur": "alis", "tutar": "400", "tarih": "2026-03-10"},
]


def p_ortak(gec2):
    return {
        "k1:fatura:P2F:acik": 40000, "k1:hareket:p2b:kalan": 0, "k1:cari:P2:bakiye": 40000, "k1:cari:P2:gecikmis": gec2,
        "k1:cari:P2:acikToplam": 40000, "k1:cari:P2:acikEsitBakiye": True, **yok3("k1", "p2b"),
        "k1:fatura:P3F:acik": 50000, "k1:cari:P3:bakiye": 50000, "k1:cari:P3:gecikmis": 20000, **yok3("k1", "p3o"),
        "k1:cari:P3:acikToplam": 50000, "k1:cari:P3:acikEsitBakiye": True,
    }


bek27 = dict(p_ortak(0))
bek27.update({
    "k1:fatura:P1B:acik": 0, "k1:fatura:P1A:acik": 30000, "k1:cari:P1:bakiye": 30000, "k1:cari:P1:gecikmis": 30000,
    "k1:cari:P1:acikToplam": 30000, "k1:cari:P1:acikEsitBakiye": True, "k1:takvim:fatura:P1A": {"amount": 30000, "direction": "in"},
    "k1:fatura:P4F:acik": 0, "k1:cari:P4a:bakiye": -40000, "k1:cari:P4a:gecikmis": 0, "k1:cari:P4a:acikToplam": 0, "k1:cari:P4a:acikEsitBakiye": False,
    "k1:fatura:P4G:acik": 50000, "k1:cari:P4b:bakiye": 50000, "k1:cari:P4b:gecikmis": 50000, "k1:cari:P4b:acikToplam": 50000, "k1:cari:P4b:acikEsitBakiye": True,
    "k1:takvim:fatura:P4G": {"amount": 50000, "direction": "in"},
    "k1:cari:P5:bakiye": 50000,
    "k1:takvim:cariKalemSayisi": 0, "k1:projeksiyon:cari": 0,
})
yaz("d27-c5-s99-taksitli-avans", "2026-06-15",
    "2.5.0 bakım 6 C18 (KULLANICI S99 = A, 10.11 13:27; bugün 15.06): FATURA DURUMU da tek kuyruktan — bağsız avans vade sırasıyla taksitli faturanın taksitlerini de kapatır. P1 kararın örneği "
    "(avans 500 → taksitli B 300 → taksitsiz A 500: B Ödendi, A 300 açık; Σ fatura açığı = bakiye). P2 taksitler farklı vadelerde, avans kısmen kapatır (1. taksit 300 + 2. taksitin 100'ü), "
    "sonraki tahsilat vade sırasıyla (Borç 10.06 → 2. taksit 20.06): fatura 400 açık. P3 verilen avans (S98) + taksitli fatura: tahsilat önce avansı (vade 01.05) sonra 1. taksiti kapatır — "
    "fatura 500 açık, gecikmiş 200 (bakım 5'te Y5-7 ile susuyordu). P4 aynı adlı iki cari. P5 SK-15: taksitli satış + alış — kâhin susar.",
    "KARARLAR.md §18 Y6-2, Y6-3, SK-15; S99 A, S98 A, S50 A", P + P_EK, bek27,
    yok=["k1:fatura:P5F:acik", "k1:fatura:P5A:acik", "k1:cari:P5:gecikmis", "k1:cari:P5:acikToplam"],
    belirsiz=[["cari P5", "SK-15"]])
yaz("d28-c5-s99-taksit-vade-gunu", "2026-06-20",
    "d27'nin P2 / P3'ü, bugün 20.06 (P2'nin 2. taksitinin VADE GÜNÜ — gecikmiş değil, M1f): P2 gecikmiş 0, P3 20.000; açıklar aynı.",
    "KARARLAR.md §18 Y6-3; S99 A, M1f", copy.deepcopy(P), p_ortak(0))
b29 = p_ortak(10000)
yaz("d29-c5-s99-taksit-ertesi-gun", "2026-06-21",
    "d27'nin P2 / P3'ü, bugün 21.06 (GÜN DÖNÜMÜ — P2'nin 2. taksiti vadesinin ertesi): P2 gecikmiş 100 (2. taksitin kalanı), P3 200; açıklar aynı.",
    "KARARLAR.md §18 Y6-3; S99 A, S1 A, M1f", copy.deepcopy(P), b29)

# ─────────────────────────── d30 / d31 / d32 — S101 A (avansla kapanmış borca açılan Mevcut Borç kartı "Bitti")
Q = [
    # Q2 kısmen avansla kapanmış borca kart: avans 400 → satış 600 → kart 600 (2 × 300; 01.06 / 01.07): 1. taksit 300 + 2. taksitin 100'ü avansla ödenmiş, 2. taksit 200 açık
    {"id": "cq2", "islem": "cari_ac", "ad": "Q2", "isim": "Kısmi Bitti", "tarih": "2026-04-01"},
    {"id": "q2t", "islem": "tahsilat", "cari": "Q2", "tutar": "400", "tarih": "2026-05-01"},
    {"id": "q2s", "islem": "stok_satis_hesap", "cari": "Q2", "tutar": "600", "tarih": "2026-05-05"},
    {"id": "kq2", "islem": "kart_ac", "ad": "KQ2", "cari": "Q2", "tutar": "600", "taksit": 2, "ilkVade": "2026-06-01", "tarih": "2026-05-05", "mevcut": True},
    # Q4 kısmen avanslı + kart tahsilatı açık kısmı AŞMIYOR (100 < 200): 2. taksit 100 açık
    {"id": "cq4", "islem": "cari_ac", "ad": "Q4", "isim": "Aşmayan Taksit", "tarih": "2026-04-01"},
    {"id": "q4t", "islem": "tahsilat", "cari": "Q4", "tutar": "400", "tarih": "2026-05-01"},
    {"id": "q4s", "islem": "stok_satis_hesap", "cari": "Q4", "tutar": "600", "tarih": "2026-05-05"},
    {"id": "kq4", "islem": "kart_ac", "ad": "KQ4", "cari": "Q4", "tutar": "600", "taksit": 2, "ilkVade": "2026-06-01", "tarih": "2026-05-05", "mevcut": True},
    {"id": "q4k", "islem": "kart_tahsilat", "kayit": "KQ4", "tutar": "100", "tarih": "2026-05-20"},
]
Q_EK = [
    # Q1 S101'in örneği: 1.000 avans → 600 veresiye satış + 2 taksit → Taksit Tahsilatı 300 → Borç Yaz 500 ⇒ kart Bitti, takvim / zil boş, gecikmiş 0, müşteri 200 alacaklı
    {"id": "cq1", "islem": "cari_ac", "ad": "Q1", "isim": "Kemal Bitti", "tarih": "2026-04-01"},
    {"id": "q1t", "islem": "tahsilat", "cari": "Q1", "tutar": "1000", "tarih": "2026-05-01"},
    {"id": "q1s", "islem": "stok_satis_hesap", "cari": "Q1", "tutar": "600", "tarih": "2026-05-05"},
    {"id": "kq1", "islem": "kart_ac", "ad": "KQ1", "cari": "Q1", "tutar": "600", "taksit": 2, "ilkVade": "2026-06-01", "tarih": "2026-05-05", "mevcut": True},
    {"id": "q1k", "islem": "kart_tahsilat", "kayit": "KQ1", "tutar": "300", "tarih": "2026-05-10"},
    {"id": "q1b", "islem": "borc", "cari": "Q1", "tutar": "500", "tarih": "2026-05-12"},
    # Q3 kısmen avanslı + kart tahsilatı açık kısmı AŞIYOR (500 > 200): kart Bitti, fazlası 300 avans
    {"id": "cq3", "islem": "cari_ac", "ad": "Q3", "isim": "Aşan Taksit", "tarih": "2026-04-01"},
    {"id": "q3t", "islem": "tahsilat", "cari": "Q3", "tutar": "400", "tarih": "2026-05-01"},
    {"id": "q3s", "islem": "stok_satis_hesap", "cari": "Q3", "tutar": "600", "tarih": "2026-05-05"},
    {"id": "kq3", "islem": "kart_ac", "ad": "KQ3", "cari": "Q3", "tutar": "600", "taksit": 2, "ilkVade": "2026-06-01", "tarih": "2026-05-05", "mevcut": True},
    {"id": "q3k", "islem": "kart_tahsilat", "kayit": "KQ3", "tutar": "500", "tarih": "2026-05-20"},
    # Q5 SK-14: Bitti karttan sonra vadeleri doğum sırasına uymayan iki borç, sonra Taksit Tahsilatı — iki okuma ayrışır, kâhin susar
    {"id": "cq5", "islem": "cari_ac", "ad": "Q5", "isim": "Ayrışan Kart", "tarih": "2026-04-01"},
    {"id": "q5t", "islem": "tahsilat", "cari": "Q5", "tutar": "1000", "tarih": "2026-05-01"},
    {"id": "q5s", "islem": "stok_satis_hesap", "cari": "Q5", "tutar": "600", "tarih": "2026-05-05"},
    {"id": "kq5", "islem": "kart_ac", "ad": "KQ5", "cari": "Q5", "tutar": "600", "taksit": 2, "ilkVade": "2026-06-01", "tarih": "2026-05-05", "mevcut": True},
    {"id": "q5x", "islem": "borc", "cari": "Q5", "tutar": "500", "tarih": "2026-05-06", "vade": "2026-06-30"},
    {"id": "q5y", "islem": "borc", "cari": "Q5", "tutar": "300", "tarih": "2026-05-07", "vade": "2026-05-08"},
    {"id": "q5k", "islem": "kart_tahsilat", "kayit": "KQ5", "tutar": "300", "tarih": "2026-05-20"},
    # Q6 kart alttaki borcun açık + avanslı kısmından büyük — EK-2B 32 tanımsızlığı AYNEN
    {"id": "cq6", "islem": "cari_ac", "ad": "Q6", "isim": "Büyük Kart", "tarih": "2026-04-01"},
    {"id": "q6t", "islem": "tahsilat", "cari": "Q6", "tutar": "1000", "tarih": "2026-05-01"},
    {"id": "q6s", "islem": "stok_satis_hesap", "cari": "Q6", "tutar": "600", "tarih": "2026-05-05"},
    {"id": "kq6", "islem": "kart_ac", "ad": "KQ6", "cari": "Q6", "tutar": "1000", "taksit": 2, "ilkVade": "2026-06-01", "tarih": "2026-05-05", "mevcut": True},
    # Q7 borç avansla DEĞİL stok iadesiyle kapanmış — S101 kurulmaz (EK-2B 32 aynen)
    {"id": "cq7", "islem": "cari_ac", "ad": "Q7", "isim": "İadeli Kart", "tarih": "2026-04-01"},
    {"id": "q7s", "islem": "stok_satis_hesap", "cari": "Q7", "tutar": "600", "tarih": "2026-05-05"},
    {"id": "q7i", "islem": "stok_iade", "cari": "Q7", "tutar": "600", "tarih": "2026-05-06"},
    {"id": "kq7", "islem": "kart_ac", "ad": "KQ7", "cari": "Q7", "tutar": "600", "taksit": 2, "ilkVade": "2026-06-01", "tarih": "2026-05-07", "mevcut": True},
    # Q8 aynı adlı iki cari: birinin avansı öbürünün kartını kapatmaz
    {"id": "cq8a", "islem": "cari_ac", "ad": "Q8a", "isim": "Aynı Kart", "tarih": "2026-04-01"},
    {"id": "cq8b", "islem": "cari_ac", "ad": "Q8b", "isim": "Aynı Kart", "tarih": "2026-04-01", "tel": "05550000008"},
    {"id": "q8t", "islem": "tahsilat", "cari": "Q8a", "tutar": "600", "tarih": "2026-05-01"},
    {"id": "q8s", "islem": "stok_satis_hesap", "cari": "Q8a", "tutar": "600", "tarih": "2026-05-05"},
    {"id": "kq8", "islem": "kart_ac", "ad": "KQ8", "cari": "Q8a", "tutar": "600", "taksit": 2, "ilkVade": "2026-06-01", "tarih": "2026-05-05", "mevcut": True},
    {"id": "q8u", "islem": "stok_satis_hesap", "cari": "Q8b", "tutar": "600", "tarih": "2026-05-05"},
    {"id": "kq8b", "islem": "kart_ac", "ad": "KQ8B", "cari": "Q8b", "tutar": "600", "taksit": 2, "ilkVade": "2026-06-01", "tarih": "2026-05-05", "mevcut": True},
]


def q_ortak(gec2, gec4):
    return {
        "k1:kart:KQ2:toplam": 60000, "k1:kart:KQ2:odenen": 40000, "k1:kart:KQ2:kalan": 20000, "k1:kart:KQ2:taksit1:odenen": 30000, "k1:kart:KQ2:taksit2:odenen": 10000,
        "k1:cari:Q2:bakiye": 20000, "k1:cari:Q2:gecikmis": gec2,
        "k1:kart:KQ4:toplam": 60000, "k1:kart:KQ4:odenen": 50000, "k1:kart:KQ4:kalan": 10000, "k1:kart:KQ4:taksit1:odenen": 30000, "k1:kart:KQ4:taksit2:odenen": 20000,
        "k1:cari:Q4:bakiye": 10000, "k1:cari:Q4:gecikmis": gec4,
    }


bek30 = dict(q_ortak(0, 0))
bek30.update({
    "k1:kart:KQ1:toplam": 60000, "k1:kart:KQ1:mevcutBorc": True, "k1:kart:KQ1:odenen": 60000, "k1:kart:KQ1:kalan": 0, "k1:kart:KQ1:taksit1:odenen": 30000, "k1:kart:KQ1:taksit2:odenen": 30000,
    "k1:hareket:q1b:kalan": 0, **yok3("k1", "q1b"), "k1:cari:Q1:bakiye": -20000, "k1:cari:Q1:gecikmis": 0, "k1:cari:Q1:acikToplam": 0, "k1:cari:Q1:acikEsitBakiye": False,
    "k1:kart:KQ3:odenen": 60000, "k1:kart:KQ3:kalan": 0, "k1:kart:KQ3:taksit1:odenen": 30000, "k1:kart:KQ3:taksit2:odenen": 30000, "k1:cari:Q3:bakiye": -30000, "k1:cari:Q3:gecikmis": 0,
    "k1:kart:KQ5:toplam": 60000, "k1:cari:Q5:bakiye": 10000,
    "k1:kart:KQ6:toplam": 100000, "k1:cari:Q6:bakiye": -40000,
    "k1:kart:KQ7:toplam": 60000, "k1:cari:Q7:bakiye": 0,
    "k1:kart:KQ8:odenen": 60000, "k1:kart:KQ8:kalan": 0, "k1:cari:Q8a:bakiye": 0, "k1:cari:Q8a:gecikmis": 0,
    "k1:kart:KQ8B:odenen": 0, "k1:kart:KQ8B:kalan": 60000, "k1:kart:KQ8B:taksit1:odenen": 0, "k1:kart:KQ8B:taksit2:odenen": 0, "k1:cari:Q8b:bakiye": 60000, "k1:cari:Q8b:gecikmis": 30000,
})
yaz("d30-c5-s101-bitti-kart", "2026-06-15",
    "2.5.0 bakım 6 C18 (KULLANICI S101 = A, 10.11 18:22; bugün 15.06): borç avansla zaten kapanmışken açılan Mevcut Borç kartı 'Bitti'; kartın tahsilatı avansa eklenir; sonraki borç avanstan "
    "kapanır. Q1 kararın örneği (kart Bitti, Borç 0, gecikmiş 0, müşteri 200 alacaklı). Q2 kısmen avanslı borca kart (1. taksit + 2. taksitin 100'ü ödenmiş, 2. taksit 200 açık). Q3 / Q4 kart "
    "tahsilatı açık kısmı aşıyor (fazlası avans) / aşmıyor. Q5 SK-14 (iki okuma ayrışır — susar). Q6 kart borcun açık + avanslı kısmından büyük (EK-2B 32 aynen). Q7 borç stok iadesiyle kapanmış "
    "(S101 'AVANSLA' — kurulmaz). Q8 aynı adlı iki cari. Bakım 5'te Q1–Q4 ve Q8a C13.4 (11) ile tanımsızdı (EK-2B 32).",
    "KARARLAR.md §18 Y6-4, Y6-5, SK-14; S101 A, M1e, S99 A, 2B-S3 A", Q + Q_EK, bek30,
    yok=["k1:kart:KQ5:odenen", "k1:kart:KQ5:kalan", "k1:hareket:q5x:kalan", "k1:hareket:q5y:kalan", "k1:cari:Q5:gecikmis", "k1:kart:KQ6:odenen", "k1:kart:KQ7:odenen",
         "k1:takvim:cariKalemSayisi", "k1:projeksiyon:cari"],
    belirsiz=[["cari Q5 tanımsız", "SK-14"], ["cari Q6 tanımsız", "EK-2B 32"], ["cari Q7 tanımsız", "EK-2B 32"]])
yaz("d31-c5-s101-taksit-vade-gunu", "2026-07-01",
    "d30'un Q2 / Q4'ü, bugün 01.07 (2. taksitin VADE GÜNÜ — gecikmiş değil, M1f): gecikmiş 0 / 0; kart ödenenleri aynı.", "KARARLAR.md §18 Y6-4; S101 A, M1f", copy.deepcopy(Q), q_ortak(0, 0))
yaz("d32-c5-s101-taksit-ertesi-gun", "2026-07-02",
    "d30'un Q2 / Q4'ü, bugün 02.07 (GÜN DÖNÜMÜ — 2. taksit vadesinin ertesi): gecikmiş 200 / 100 (2. taksitlerin açık kısmı); kart ödenenleri aynı.", "KARARLAR.md §18 Y6-4; S101 A, S1 A, M1f",
    copy.deepcopy(Q), q_ortak(20000, 10000))

# ─────────────────────────── d33 — S102–S105 + SK-13 sınırları (bir gün kaydırılmış), SK-17 susan
T = [
    # T9a S102: tahsilat iki netleşmenin de ERTESİ günü (04.06) — önceki günlerin ikisi de geri alınır: X 300, Y 300 açık, Borç 0
    {"id": "ct9a", "islem": "cari_ac", "ad": "T9a", "isim": "Sınır Önceki", "tarih": "2026-05-01"},
    {"id": "t9ab", "islem": "borc", "cari": "T9a", "tutar": "1000", "tarih": "2026-06-01"},
    {"id": "t9ax", "islem": "alacak", "cari": "T9a", "tutar": "300", "tarih": "2026-06-02"},
    {"id": "t9ay", "islem": "alacak", "cari": "T9a", "tutar": "300", "tarih": "2026-06-03"},
    {"id": "t9at", "islem": "tahsilat", "cari": "T9a", "tutar": "1000", "tarih": "2026-06-04"},
    # T9b S102: tahsilat X'in GÜNÜNDE (02.06), Y sonra (03.06) — X'in aynı gün netleşmesi kalır; Y avansla netleşmez (aynı yön): X 0, Y 300 açık, avans 300
    {"id": "ct9b", "islem": "cari_ac", "ad": "T9b", "isim": "Sınır Aynı Gün", "tarih": "2026-05-01"},
    {"id": "t9bb", "islem": "borc", "cari": "T9b", "tutar": "1000", "tarih": "2026-06-01"},
    {"id": "t9bx", "islem": "alacak", "cari": "T9b", "tutar": "300", "tarih": "2026-06-02"},
    {"id": "t9bt", "islem": "tahsilat", "cari": "T9b", "tutar": "1000", "tarih": "2026-06-02"},
    {"id": "t9by", "islem": "alacak", "cari": "T9b", "tutar": "300", "tarih": "2026-06-03"},
    # T10b S103: tedarikçi tahsilatı alışın GÜNÜNDE (05.03) — aynı gün iki okuma da kesin: alış Ödendi, tedarikçinin avansı 300
    {"id": "ct10b", "islem": "cari_ac", "ad": "T10b", "isim": "Aynı Gün Geri", "tarih": "2026-02-01", "tur": "tedarikci"},
    {"id": "t10bo", "islem": "odeme", "cari": "T10b", "tutar": "500", "tarih": "2026-03-01"},
    {"id": "t10bf", "islem": "fatura", "ad": "T10BF", "cari": "T10b", "tur": "alis", "tutar": "300", "tarih": "2026-03-05"},
    {"id": "t10bt", "islem": "tahsilat", "cari": "T10b", "tutar": "500", "tarih": "2026-03-05"},
    # T10c S103: tahsilat alışın ERTESİ günü (06.03) — kesin (S103 A): alış Ödendi (B'de alış 300 açık olurdu)
    {"id": "ct10c", "islem": "cari_ac", "ad": "T10c", "isim": "Ertesi Gün Geri", "tarih": "2026-02-01", "tur": "tedarikci"},
    {"id": "t10co", "islem": "odeme", "cari": "T10c", "tutar": "500", "tarih": "2026-03-01"},
    {"id": "t10cf", "islem": "fatura", "ad": "T10CF", "cari": "T10c", "tur": "alis", "tutar": "300", "tarih": "2026-03-05"},
    {"id": "t10ct", "islem": "tahsilat", "cari": "T10c", "tutar": "500", "tarih": "2026-03-06"},
    # T11b S104 sınırı: Alacak vadesi avansın ERTESİ günü (02.03) — önce avans: avans 200, Alacak 200 açık
    {"id": "ct11b", "islem": "cari_ac", "ad": "T11b", "isim": "Vade Ertesi", "tarih": "2026-02-01"},
    {"id": "t11ba", "islem": "alacak", "cari": "T11b", "tutar": "200", "tarih": "2026-02-28", "vade": "2026-03-02"},
    {"id": "t11bt", "islem": "tahsilat", "cari": "T11b", "tutar": "500", "tarih": "2026-03-01"},
    {"id": "t11bo", "islem": "odeme", "cari": "T11b", "tutar": "300", "tarih": "2026-03-10"},
    # T11c S104 sınırı: Alacak vadesi avanstan ÖNCE (28.02) — önce Alacak: Alacak 0, avans 400
    {"id": "ct11c", "islem": "cari_ac", "ad": "T11c", "isim": "Vade Önce", "tarih": "2026-02-01"},
    {"id": "t11ca", "islem": "alacak", "cari": "T11c", "tutar": "200", "tarih": "2026-02-25", "vade": "2026-02-28"},
    {"id": "t11ct", "islem": "tahsilat", "cari": "T11c", "tutar": "500", "tarih": "2026-03-01"},
    {"id": "t11co", "islem": "odeme", "cari": "T11c", "tutar": "300", "tarih": "2026-03-10"},
    # T12b S105: alış iadeden küçük (150 < 200) — önce iade: iade alacağı 50 açık, avans 300 (gecikmiş: açık iade notu kararda yok → yazılmaz)
    {"id": "ct12b", "islem": "cari_ac", "ad": "T12b", "isim": "Küçük Alış", "tarih": "2026-02-01", "tur": "tedarikci"},
    {"id": "t12bo", "islem": "odeme", "cari": "T12b", "tutar": "300", "tarih": "2026-03-01"},
    {"id": "t12bi", "islem": "alis_iade", "cari": "T12b", "tutar": "200", "tarih": "2026-03-05"},
    {"id": "t12bf", "islem": "fatura", "ad": "T12BF", "cari": "T12b", "tur": "alis", "tutar": "150", "tarih": "2026-03-10"},
    # T12c S105 sınırı: iade avanstan ÖNCE (01.03 iade, 05.03 Ödeme) — iki okuma aynı: iade 0, avans 250
    {"id": "ct12c", "islem": "cari_ac", "ad": "T12c", "isim": "İade Önce", "tarih": "2026-02-01", "tur": "tedarikci"},
    {"id": "t12ci", "islem": "alis_iade", "cari": "T12c", "tutar": "200", "tarih": "2026-03-01"},
    {"id": "t12co", "islem": "odeme", "cari": "T12c", "tutar": "300", "tarih": "2026-03-05"},
    {"id": "t12cf", "islem": "fatura", "ad": "T12CF", "cari": "T12c", "tur": "alis", "tutar": "250", "tarih": "2026-03-10"},
    # T13b SK-13 ← S99: fatura avanstan ÖNCE (01.03; Ödeme 05.03) — tahsilat önce faturayı kapatır: fatura 0, avans 150
    {"id": "ct13b", "islem": "cari_ac", "ad": "T13b", "isim": "Fatura Önce", "tarih": "2026-02-01"},
    {"id": "t13bf", "islem": "fatura", "ad": "T13BF", "cari": "T13b", "tutar": "100", "tarih": "2026-03-01"},
    {"id": "t13bo", "islem": "odeme", "cari": "T13b", "tutar": "200", "tarih": "2026-03-05"},
    {"id": "t13bt", "islem": "tahsilat", "cari": "T13b", "tutar": "150", "tarih": "2026-03-10"},
    # T13c SK-13 sınırı: Ödeme ve fatura AYNI gün (Ödeme önce yazıldı — ders 31): tahsilat önce avans: fatura 100 açık, avans 50
    {"id": "ct13c", "islem": "cari_ac", "ad": "T13c", "isim": "Aynı Gün Fatura", "tarih": "2026-02-01"},
    {"id": "t13co", "islem": "odeme", "cari": "T13c", "tutar": "200", "tarih": "2026-03-01"},
    {"id": "t13cf", "islem": "fatura", "ad": "T13CF", "cari": "T13c", "tutar": "100", "tarih": "2026-03-01"},
    {"id": "t13ct", "islem": "tahsilat", "cari": "T13c", "tutar": "150", "tarih": "2026-03-10"},
    # T17 SK-17: alınan avans + alış açıkken yeni satış — net görünüm susar (belge durumları yazılır: iki kalem belgede netleşmez)
    {"id": "ct17", "islem": "cari_ac", "ad": "T17", "isim": "Avanslı Alıcı", "tarih": "2026-02-01"},
    {"id": "t17t", "islem": "tahsilat", "cari": "T17", "tutar": "500", "tarih": "2026-03-01"},
    {"id": "t17a", "islem": "fatura", "ad": "T17A", "cari": "T17", "tur": "alis", "tutar": "300", "tarih": "2026-03-05"},
    {"id": "t17s", "islem": "fatura", "ad": "T17S", "cari": "T17", "tutar": "600", "tarih": "2026-03-10"},
]
bek33 = {
    "k1:hareket:t9ab:kalan": 0, "k1:hareket:t9ax:kalan": 30000, "k1:hareket:t9ay:kalan": 30000, "k1:cari:T9a:bakiye": -60000, "k1:cari:T9a:gecikmis": 0,
    "k1:takvim:hareket:t9ax": kalem(30000, "2026-06-02", "out", "Ödenecek Borç", "overdue", -13, "T9a", "Sınır Önceki"),
    "k1:takvim:hareket:t9ay": kalem(30000, "2026-06-03", "out", "Ödenecek Borç", "overdue", -12, "T9a", "Sınır Önceki"),
    "k1:hareket:t9bb:kalan": 0, "k1:hareket:t9bx:kalan": 0, "k1:hareket:t9by:kalan": 30000, "k1:cari:T9b:bakiye": -60000, "k1:cari:T9b:gecikmis": 0,
    "k1:takvim:hareket:t9by": kalem(30000, "2026-06-03", "out", "Ödenecek Borç", "overdue", -12, "T9b", "Sınır Aynı Gün"), "k1:takvim:hareket:t9bx": "yok",
    "k1:fatura:T10BF:acik": 0, **yok3("k1", "t10bo"), "k1:cari:T10b:bakiye": -30000, "k1:cari:T10b:gecikmis": 0,
    "k1:fatura:T10CF:acik": 0, **yok3("k1", "t10co"), "k1:cari:T10c:bakiye": -30000, "k1:cari:T10c:gecikmis": 0,
    "k1:hareket:t11ba:kalan": 20000, "k1:cari:T11b:bakiye": -40000, "k1:cari:T11b:gecikmis": 0, **yok3("k1", "t11bo"),
    "k1:takvim:hareket:t11ba": kalem(20000, "2026-03-02", "out", "Ödenecek Borç", "overdue", -105, "T11b", "Vade Ertesi"),
    "k1:vadeTakip:hareket:t11ba": {"amount": 20000, "date": "2026-03-02", "direction": "out"}, "k1:projeksiyon:hareket:t11ba": {"amount": 20000, "date": "2026-03-02", "direction": "out"},
    "k1:hareket:t11ca:kalan": 0, "k1:cari:T11c:bakiye": -40000, "k1:cari:T11c:gecikmis": 0, **yok3("k1", "t11ca"), **yok3("k1", "t11co"),
    "k1:fatura:T12BF:acik": 0, "k1:cari:T12b:bakiye": 35000,
    "k1:takvim:hareket:t12bo": kalem(30000, "2026-03-01", "in", "Tahsil Edilecek Borç", "overdue", -106, "T12b", "Küçük Alış"),
    "k1:fatura:T12CF:acik": 0, "k1:cari:T12c:bakiye": 25000, "k1:cari:T12c:gecikmis": 25000,
    "k1:takvim:hareket:t12co": kalem(25000, "2026-03-05", "in", "Tahsil Edilecek Borç", "overdue", -102, "T12c", "İade Önce"),
    "k1:takvim:cariToplam:T12c": 25000, "k1:vadeTakip:cariToplam:T12c": 25000, "k1:projeksiyon:cariToplam:T12c": 25000,
    "k1:fatura:T13BF:acik": 0, "k1:cari:T13b:bakiye": 15000, "k1:cari:T13b:gecikmis": 15000,
    "k1:takvim:hareket:t13bo": kalem(15000, "2026-03-05", "in", "Tahsil Edilecek Borç", "overdue", -102, "T13b", "Fatura Önce"),
    "k1:cari:T13b:acikToplam": 0, "k1:cari:T13b:acikEsitBakiye": False,
    "k1:fatura:T13CF:acik": 10000, "k1:cari:T13c:bakiye": 15000, "k1:cari:T13c:gecikmis": 15000,
    "k1:takvim:hareket:t13co": kalem(5000, "2026-03-01", "in", "Tahsil Edilecek Borç", "overdue", -106, "T13c", "Aynı Gün Fatura"),
    "k1:cari:T13c:acikToplam": 10000, "k1:cari:T13c:acikEsitBakiye": False,
    "k1:cari:T17:bakiye": -20000, "k1:fatura:T17S:acik": 10000, "k1:fatura:T17A:acik": 30000,
    "k1:takvim:cariKalemSayisi": {"catal": [8, 9]}, "k1:projeksiyon:cari": {"catal": [8, 9]},
}
yaz("d33-c5-s102-s105-sinirlar", "2026-06-15",
    "2.5.0 bakım 6 C18 (KULLANICI S102 / S103 / S104 / S105 = A, 10.11 18:28; SK-13 ← S99 A; bugün 15.06) — kararların bir gün kaydırılmış sınırları: T9a / T9b S102 (tahsilat iki netleşmenin "
    "ertesi günü ↔ ilk netleşmenin günü), T10b / T10c S103 (tedarikçi tahsilatı alışın günü ↔ ertesi günü — ikisinde de alış Ödendi), T11b / T11c S104 (Alacak vadesi avansın ertesi ↔ öncesi), "
    "T12b / T12c S105 (alış iadeden küçük ↔ iade avanstan önce), T13b / T13c SK-13 (fatura avanstan önce ↔ aynı gün, Ödeme önce yazıldı). T17 SK-17 (alınan avans + alış açıkken satış — net "
    "görünüm susar, belge durumları yazılır). Sayaçlar T12b'nin açık alış iadesi alacağı yüzünden ÇATAL (belirsiz üye — §17 aynen).",
    "KARARLAR.md §18 Y6-1, Y6-2, Y6-8, SK-17; S102–S105 A, S99 A, S98 A", T, bek33,
    yok=["k1:cari:T12b:gecikmis", "k1:cari:T17:gecikmis", "k1:takvim:fatura:T17S", "k1:takvim:fatura:T17A"],
    belirsiz=[["cari T17 net görünüm tanımsız", "SK-17"]])
print("d27–d33 yazıldı")
