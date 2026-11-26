#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Cari kâhini bakımı 29 (§41): d61 elle senaryosunun üreteci — beklenenler KARAR METNİNDEN ELLE (kâhin koşulmadan; her sayının hesabı yorum satırında).
  python3 -I uret-d61.py > test/bagimsiz/cari/senaryolar/d61-c5-s266-s265-yalin-olmayan.json
Bugün 15.06.2026. Kuruş. Etiket / kural metni karşılaştırılmaz (yalnız değer)."""
import json

BUGUN = "2026-06-15"
A, E, Y, B = [], {}, [], []


def adim(**k):
    A.append(k)


def kalem(cari, isim, tutar, tarih, gun, yon):
    return {"amount": tutar, "dueDate": tarih, "direction": yon, "label": "Tahsil Edilecek Borç" if yon == "in" else "Ödenecek Borç",
            "state": "overdue" if gun < 0 else "today" if gun == 0 else "upcoming", "days": gun, "cari": cari, "person": isim}


def gorunum(hn, cari, isim, tutar, tarih, gun, yon):
    E["k1:takvim:hareket:%s" % hn] = kalem(cari, isim, tutar, tarih, gun, yon)
    E["k1:vadeTakip:hareket:%s" % hn] = {"amount": tutar, "date": tarih, "direction": yon}
    E["k1:projeksiyon:hareket:%s" % hn] = {"amount": tutar, "date": tarih, "direction": yon}


def yok(hn):
    for g in ("takvim", "vadeTakip", "projeksiyon"):
        E["k1:%s:hareket:%s" % (g, hn)] = "yok"


# ── U1 — KS8 carisi (faturasız iade geri ödemesi tamamlanmış) + kararın örneği (S104 = A → S266 = A; Y29-3 (b)) ─────────────────────────────
# 01.02 stok iadesi 100 (borcu yok → açık not 100) · 05.02 Ödeme 100 (K-b: notu geri öder — G 100) · 01.03 tahsilat 500 (borcu yok → alınan avans 500)
# · 05.03 Alacak 200 (vade 30.04) · 10.03 Ödeme 300. S104: Ödeme'nin gününde açık avans (01.03) ile Alacak (vade 30.04) vade sırasıyla → avans önce: avans 200 kalır,
# Alacak 200 AÇIK, Ödeme'nin verilen avans kalemi YOK. İade geri ödemesi her iki okumada 100 (değişmez) → (b) yazılır.
# Bakiye = −100 + 100 − 500 − 200 + 300 = −400 (−40.000 kuruş). Alacak Kalan 200; takvim "Ödenecek Borç" 30.04 (bugünden −46 gün, gecikmiş). Carinin gecikmişi (borç yönlü) 0.
# Σ açık = −Alacak 200 = −20.000 ≠ bakiye (alınan avans 200 kalem değil — S96 / S103).
I1 = "Uğur Birinci"
adim(id="cu1", islem="cari_ac", ad="U1", isim=I1, tarih="2026-01-15")
adim(id="u1i", islem="stok_iade", cari="U1", tutar="100", tarih="2026-02-01")
adim(id="u1o1", islem="odeme", cari="U1", tutar="100", tarih="2026-02-05")
adim(id="u1t", islem="tahsilat", cari="U1", tutar="500", tarih="2026-03-01")
adim(id="u1a", islem="alacak", cari="U1", tutar="200", tarih="2026-03-05", vade="2026-04-30")
adim(id="u1o2", islem="odeme", cari="U1", tutar="300", tarih="2026-03-10")
E["k1:cari:U1:bakiye"] = -40000
E["k1:hareket:u1a:kalan"] = 20000
gorunum("u1a", "U1", I1, 20000, "2026-04-30", -46, "out")
yok("u1o1")
yok("u1o2")
E["k1:cari:U1:gecikmis"] = 0
E["k1:cari:U1:acikToplam"] = -20000
E["k1:cari:U1:acikEsitBakiye"] = False

# ── U2 — KS8 carisi, alacak yönlü kalem YOK (Y29-3 (a)): iade geri ödemesi önce (KS8.1 ikinci aşama), FAZLASI açık alınan avansı kapatır ──────────
# 01.02 Borç 300 (vadesiz) · 10.02 stok iadesi 300 (Borç'u kapatır; not 0) · 20.02 tahsilat 500 (borç kapalı → alınan avans 500) · 01.03 Ödeme 400 ·
# 10.03 Borç 150 (vade 10.04). Ödeme: açık not yok → KS8.1 ikinci aşama: iadenin kapattığı 300 geri ödenir (Borç 300 yeniden açılır, iade kapatıcı 0) — bugünkü gibi;
# tahsilat 20.02 açılan Borç 300'ü kapatır → avans 200. Ödeme'nin fazlası 100 (bugün verilen avans kalemi) S104 ile Ödeme'nin gününde açık avansı kapatır → avans 100,
# verilen avans YOK. 10.03 Borç 150 avanstan 100 kapanır → Kalan 50 (vade 10.04 — bugünden −66 gün, gecikmiş 50).
# Bakiye = 300 − 300 − 500 + 400 + 150 = 50 = Borç 150'nin Kalan'ı (Σ açık = bakiye).
I2 = "Uğur İkinci"
adim(id="cu2", islem="cari_ac", ad="U2", isim=I2, tarih="2026-01-15")
adim(id="u2b", islem="borc", cari="U2", tutar="300", tarih="2026-02-01")
adim(id="u2i", islem="stok_iade", cari="U2", tutar="300", tarih="2026-02-10")
adim(id="u2t", islem="tahsilat", cari="U2", tutar="500", tarih="2026-02-20")
adim(id="u2o", islem="odeme", cari="U2", tutar="400", tarih="2026-03-01")
adim(id="u2b2", islem="borc", cari="U2", tutar="150", tarih="2026-03-10", vade="2026-04-10")
E["k1:cari:U2:bakiye"] = 5000
E["k1:hareket:u2b:kalan"] = 0
E["k1:takvim:hareket:u2b"] = "yok"
E["k1:hareket:u2b2:kalan"] = 5000
gorunum("u2b2", "U2", I2, 5000, "2026-04-10", -66, "in")
yok("u2o")
E["k1:cari:U2:gecikmis"] = 5000
E["k1:cari:U2:acikToplam"] = 5000
E["k1:cari:U2:acikEsitBakiye"] = True

# ── U3 — şüpheli / değersiz kaydı olan cari (iade yok): bağsız Ödeme açık alınan avansı kapatır (S104 — Y29-3 (a)) ───────────────────────────
# 01.02 Borç 1.000 (vadesiz) · 05.02 Şüpheli Alacağa Al 400 + aynı gün Değersiz 400 (kayıt kapanır; Değersiz bağsız kapatıcı → Borç 600) · 20.02 tahsilat 900
# (Borç 0, alınan avans 300) · 01.03 Ödeme 200 → S104: açık avansı kapatır (avans 100; verilen avans kalemi YOK — bugün 200'lük "Tahsil Edilecek Borç") ·
# 10.03 Borç 250 (vade 10.04): avanstan 100 → Kalan 150 (gecikmiş 150). Bakiye = 1.000 − 400 − 900 + 200 + 250 = 150. Şüpheli kaydı kapalı (açık şüpheli 0 → S130
# görünen tutar = Kalan; S159).
I3 = "Uğur Üçüncü"
adim(id="cu3", islem="cari_ac", ad="U3", isim=I3, tarih="2026-01-15")
adim(id="u3b", islem="borc", cari="U3", tutar="1000", tarih="2026-02-01")
adim(id="u3s", islem="supheli_al", ad="SU3", cari="U3", tutar="400", tarih="2026-02-05")
adim(id="u3d", islem="degersiz", supheli="SU3", tutar="400", tarih="2026-02-05")
adim(id="u3t", islem="tahsilat", cari="U3", tutar="900", tarih="2026-02-20")
adim(id="u3o", islem="odeme", cari="U3", tutar="200", tarih="2026-03-01")
adim(id="u3b2", islem="borc", cari="U3", tutar="250", tarih="2026-03-10", vade="2026-04-10")
E["k1:cari:U3:bakiye"] = 15000
E["k1:hareket:u3b:kalan"] = 0
E["k1:takvim:hareket:u3b"] = "yok"
E["k1:hareket:u3b2:kalan"] = 15000
gorunum("u3b2", "U3", I3, 15000, "2026-04-10", -66, "in")
yok("u3o")
E["k1:cari:U3:gecikmis"] = 15000

# ── U4 — KS8 carisi + Alacak, avans ↔ iade notu sırası Ödeme'nin iade geri ödemesini değiştiriyor → SUS (Y29-3 (b) — SK-54) ────────────────────
# 01.03 tahsilat 500 · 05.03 Alacak 200 (vade 30.04) · 08.03 stok iadesi 100 (borcu yok — açık not 100) · 10.03 Ödeme 300. Tek vade sırası (avans 01.03 önce): avans 200,
# not 100 açık, Alacak 200 açık (iade geri ödemesi 0); bugünkü iade önce okuması: not 100 + Alacak 200 (iade geri ödemesi 100) → ayrışıyor → kuyruk denetimleri SUS.
# Bakiye = −500 − 200 − 100 + 300 = −500 (yazılır).
I4 = "Uğur Dördüncü"
adim(id="cu4", islem="cari_ac", ad="U4", isim=I4, tarih="2026-01-15")
adim(id="u4t", islem="tahsilat", cari="U4", tutar="500", tarih="2026-03-01")
adim(id="u4a", islem="alacak", cari="U4", tutar="200", tarih="2026-03-05", vade="2026-04-30")
adim(id="u4i", islem="stok_iade", cari="U4", tutar="100", tarih="2026-03-08")
adim(id="u4o", islem="odeme", cari="U4", tutar="300", tarih="2026-03-10")
E["k1:cari:U4:bakiye"] = -50000
Y += ["k1:hareket:u4a:kalan", "k1:takvim:hareket:u4a", "k1:vadeTakip:hareket:u4a", "k1:takvim:hareket:u4o", "k1:vadeTakip:hareket:u4o", "k1:cari:U4:gecikmis",
      "k1:cari:U4:acikToplam"]
B.append(["k1: cari U4 tanımsız", "SK-54"])

# ── U5 — KS8 carisi + Alacak'ın vadesi avanstan ÖNCE (S104 vade sırası: Alacak önce) — iki okuma aynı → değerle ───────────────────────────────
# 01.02 stok iadesi 100 · 05.02 Ödeme 100 (notu geri öder) · 25.02 Alacak 200 (vade 28.02) · 01.03 tahsilat 500 · 10.03 Ödeme 300: Alacak (vade 28.02) önce 200
# → Alacak 0; kalan 100 avansı (01.03) kapatır → avans 400; verilen avans kalemi YOK (bugün 100'lük "Tahsil Edilecek Borç"). Bakiye = −100 + 100 − 200 − 500 + 300 = −400.
# Σ açık 0 ≠ bakiye.
I5 = "Uğur Beşinci"
adim(id="cu5", islem="cari_ac", ad="U5", isim=I5, tarih="2026-01-15")
adim(id="u5i", islem="stok_iade", cari="U5", tutar="100", tarih="2026-02-01")
adim(id="u5o1", islem="odeme", cari="U5", tutar="100", tarih="2026-02-05")
adim(id="u5a", islem="alacak", cari="U5", tutar="200", tarih="2026-02-25", vade="2026-02-28")
adim(id="u5t", islem="tahsilat", cari="U5", tutar="500", tarih="2026-03-01")
adim(id="u5o2", islem="odeme", cari="U5", tutar="300", tarih="2026-03-10")
E["k1:cari:U5:bakiye"] = -40000
E["k1:hareket:u5a:kalan"] = 0
E["k1:takvim:hareket:u5a"] = "yok"
yok("u5o1")
yok("u5o2")
E["k1:cari:U5:gecikmis"] = 0
E["k1:cari:U5:acikToplam"] = 0
E["k1:cari:U5:acikEsitBakiye"] = False

# ── U7 — S265 = C bileşimi (tedarikçi + KS9 bağsız tahsilat + açık alış iadesi + AYNI GÜN stok satışı ile alış iadesi) → alış faturası SUS ─────
# 01.02 alış 1.000 · 10.02 Alış İadesi 300 + aynı gün stok satışı 150 · 20.02 tahsilat 200. Bakiye = −1.000 + 300 + 150 − 200 = −750 (yazılır).
I7 = "Uğur Tedarik Yedi"
adim(id="cu7", islem="cari_ac", ad="U7", isim=I7, tur="tedarikci", tarih="2026-01-15")
adim(id="u7f", islem="fatura", ad="A7", cari="U7", tur="alis", tutar="1000", tarih="2026-02-01")
adim(id="u7i", islem="alis_iade", cari="U7", tutar="300", tarih="2026-02-10")
adim(id="u7s", islem="stok_satis_hesap", cari="U7", tutar="150", tarih="2026-02-10")
adim(id="u7t", islem="tahsilat", cari="U7", tutar="200", tarih="2026-02-20")
E["k1:cari:U7:bakiye"] = -75000
Y += ["k1:fatura:A7:acik", "k1:fatura:A7:gosterilen", "k1:fatura:A7:liste:gosterilen", "k1:fatura:A7:kartta", "k1:fatura:A7:taksitte", "k1:fatura:A7:liste:taksitte"]
B.append(["k1: cari U7", "S265 = C"])

# ── U8 — aynı, stok satışı ERTESİ gün (bileşim YOK → susma YOK; Y29-6): KS9 (§11) değerle ───────────────────────────────────────────────────────
# 01.02 alış 1.000 · 10.02 Alış İadesi 300 (alış 700) · 11.02 stok satışı 150 · 20.02 tahsilat 200: K-b FIFO'sunda önce stok satışı 150 (açık alış iadesi notu yok), artanı 50
# KS8.1 simetri ikinci aşama: Alış İadesi'nin geri tahsilatı → alış 50 yeniden açılır → alış açığı 750. Bakiye = −1.000 + 300 + 150 − 200 = −750 (= −alış 750).
I8 = "Uğur Tedarik Sekiz"
adim(id="cu8", islem="cari_ac", ad="U8", isim=I8, tur="tedarikci", tarih="2026-01-15")
adim(id="u8f", islem="fatura", ad="A8", cari="U8", tur="alis", tutar="1000", tarih="2026-02-01")
adim(id="u8i", islem="alis_iade", cari="U8", tutar="300", tarih="2026-02-10")
adim(id="u8s", islem="stok_satis_hesap", cari="U8", tutar="150", tarih="2026-02-11")
adim(id="u8t", islem="tahsilat", cari="U8", tutar="200", tarih="2026-02-20")
E["k1:cari:U8:bakiye"] = -75000
E["k1:fatura:A8:acik"] = 75000
E["k1:fatura:A8:gosterilen"] = 75000
E["k1:fatura:A8:liste:gosterilen"] = 75000
E["k1:fatura:A8:kartta"] = 0
E["k1:fatura:A8:taksitte"] = False
E["k1:fatura:A8:liste:taksitte"] = False

adim(id="k1", islem="kontrol", gecikmis=True, gorunumToplam=True, acikToplam=True)

sen = {"dil": "destekofis-cari/3", "ad": "d61-c5-s266-s265-yalin-olmayan", "bugun": BUGUN,
       "aciklama": "2.5.0 bakım 29 §41 (S266 = A, S265 = C — KULLANICI KURALIYLA ÖNERİ UYGULANDI; bugün 15.06): U1 KS8 carisinde kararın örneği (S104 — avans 01.03 önce: Alacak 200 açık, verilen avans yok), "
                   "U2 KS8 carisi alacak yönlü kalemsiz (iade geri ödemesi önce, fazlası açık avansı kapatır; sonraki Borç'un Kalan'ı 50), U3 şüpheli / değersiz kayıtlı cari (Ödeme avansı kapatır; Borç Kalan 150), "
                   "U4 avans ↔ iade notu sırası iade geri ödemesini değiştiriyor — SUS (SK-54), U5 Alacak'ın vadesi avanstan önce (Alacak kapanır, avans 400), U7 S265 bileşimi (alış faturası SUS — BİLİNEN SINIR), "
                   "U8 bileşimsiz (stok satışı ertesi gün — alış açığı 750 değerle).",
       "dayanak": "KARARLAR.md §41 (S266 = A, S265 = C; girdi docs/devir/2.5.0-DEVAM/kahin-cari29-kararlar.md), §18 S104 = A, §10 / §11 KS8 / KS9",
       "adimlar": A, "elleBeklenen": E, "elleYok": Y, "elleBelirsiz": B}
print(json.dumps(sen, ensure_ascii=False, indent=1))
