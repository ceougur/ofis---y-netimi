#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Cari kâhini bakımı 24 (§36): d53 / d54 / d55 elle senaryolarını yazar. Elle beklenenler KARAR METİNLERİNDEN, kâhin KOŞULMADAN elle hesaplandı (her satırın yanında hesap);
model.py'nin çıktısından TÜRETİLMEZ (ders 5, 40). Kullanım: python3 -I uret-d53.py <senaryolar klasörü>"""
import json
import os
import sys

HEDEF = sys.argv[1]
TL = 100  # kuruş


def yaz(ad, sen):
    with open(os.path.join(HEDEF, ad + ".json"), "w", encoding="utf-8") as f:
        json.dump(sen, f, ensure_ascii=False, indent=1)
        f.write("\n")


def cari(id_, ad, isim, tarih="2026-09-01"):
    return {"id": id_, "islem": "cari_ac", "ad": ad, "isim": isim, "tarih": tarih}


def fatura(id_, ad, c, tutar, adet, tarih, taksit=None):
    a = {"id": id_, "islem": "fatura", "ad": ad, "cari": c, "tur": "satis", "tutar": str(tutar), "adet": adet, "tarih": tarih}
    if taksit:
        a["taksit"] = taksit
    return a


def kart(id_, ad, c, tutar, n, ilk, tarih):
    return {"id": id_, "islem": "kart_ac", "ad": ad, "cari": c, "tutar": str(tutar), "taksit": n, "ilkVade": ilk, "tarih": tarih, "mevcut": True}


def kt(id_, k, tutar, tarih):
    return {"id": id_, "islem": "kart_tahsilat", "kayit": k, "tutar": str(tutar), "tarih": tarih}


def iade(id_, ad, f, adet, tarih):
    return {"id": id_, "islem": "iade", "ad": ad, "fatura": f, "adet": adet, "tarih": tarih}


def kontrol(id_):
    return {"id": id_, "islem": "kontrol", "gecikmis": True, "acikToplam": True}


def kart_beklenen(E, k, no, toplam, odenen, kalan, kapali=None):
    E["%s:kart:%s:var" % (k, no)] = True
    E["%s:kart:%s:mevcutBorc" % (k, no)] = True
    E["%s:kart:%s:toplam" % (k, no)] = toplam * TL
    E["%s:kart:%s:odenen" % (k, no)] = odenen * TL
    E["%s:kart:%s:kalan" % (k, no)] = kalan * TL
    if kapali is not None:
        E["%s:kart:%s:kapali" % (k, no)] = kapali


def cari_beklenen(E, k, c, bakiye, gecikmis, acik=None):
    E["%s:cari:%s:bakiye" % (k, c)] = bakiye * TL
    E["%s:cari:%s:gecikmis" % (k, c)] = gecikmis * TL
    if acik is not None:
        E["%s:cari:%s:acikToplam" % (k, c)] = acik * TL
        E["%s:cari:%s:acikEsitBakiye" % (k, c)] = acik == bakiye


def fatura_kartta(E, k, f, kendi, kartta, taksitte=True):
    """S229 / S230 (§35 Y23-2 / Y23-3) aynen: kartın tamamını aldığı fatura — gösterilen 0, kartta = kendi, 'Taksitte'."""
    E["%s:fatura:%s:acik" % (k, f)] = kendi * TL
    E["%s:fatura:%s:gosterilen" % (k, f)] = 0
    E["%s:fatura:%s:kartta" % (k, f)] = kartta * TL
    if taksitte is not None:
        E["%s:fatura:%s:taksitte" % (k, f)] = taksitte


def taksit_yok(Y, k, no, n=3):
    """Y24-9 (iv): taksiti 0'a inen kartın 'taksit<i>:odenen' anahtarları yazılmaz (görünüm — 2.5.1'E)."""
    for i in range(1, n + 1):
        Y.append("%s:kart:%s:taksit%d:odenen" % (k, no, i))


# ───────────────────────── d53: KAPANMIŞ kart (bugün 08.10.2026 — Kartı Kapat bugün; S237'nin kapanış günü)
A = []
E, Y, B = {}, [], []
A += [cari("cp1", "P1", "Pelin Kapalı Kart"), fatura("fp1", "FP1", "P1", 900, 3, "2026-09-01"), kart("kp1", "KP1", "P1", 900, 3, "2026-10-05", "2026-09-02"), kt("tp1", "KP1", 300, "2026-09-03")]
A += [cari("cp2", "P2", "Pınar Önceden Gecikmiş"), fatura("fp2", "FP2", "P2", 900, 3, "2026-09-01"), kart("kp2", "KP2", "P2", 900, 3, "2026-10-05", "2026-09-02")]
A += [cari("cp3", "P3", "Polat İade İptali"), fatura("fp3", "FP3", "P3", 900, 3, "2026-09-01"), kart("kp3", "KP3", "P3", 900, 3, "2026-10-05", "2026-09-02"), kt("tp3", "KP3", 300, "2026-09-03")]
A += [cari("cp4", "P4", "Perihan Düzenle"), fatura("fp4", "FP4", "P4", 900, 3, "2026-09-01"), kart("kp4", "KP4", "P4", 900, 3, "2026-10-05", "2026-09-02"), kt("tp4", "KP4", 300, "2026-09-03")]
A += [cari("cp5", "P5", "Peyami Kendi Kartı"), fatura("fp5", "FP5", "P5", 900, 3, "2026-09-01", {"sayi": 3, "ilkVade": "2026-10-05"}),
      {"id": "tp5", "islem": "tahsilat", "cari": "P5", "tutar": "300", "tarih": "2026-09-03"}]
A += [cari("cp6", "P6", "Pamir İki Kart"), fatura("fp6a", "F6A", "P6", 900, 3, "2026-09-01"), kart("kp6a", "K6A", "P6", 900, 3, "2026-10-05", "2026-09-02"),
      fatura("fp6b", "F6B", "P6", 600, 2, "2026-09-03"), kart("kp6b", "K6B", "P6", 600, 2, "2026-10-01", "2026-09-04")]
A += [cari("ca4", "A4", "Aslı Açık Düzenle"), fatura("fa4", "FA4", "A4", 900, 3, "2026-09-01"), kart("ka4", "KA4", "A4", 900, 3, "2026-10-05", "2026-09-02"), kt("ta4", "KA4", 300, "2026-09-03")]
A += [{"id": "kk1", "islem": "kart_kapat", "kart": "KP1"}, {"id": "kk2", "islem": "kart_kapat", "kart": "KP2"}, {"id": "kk3", "islem": "kart_kapat", "kart": "KP3"},
      {"id": "kk4", "islem": "kart_kapat", "kart": "KP4"}, {"id": "kk5", "islem": "kart_kapat", "fatura": "FP5"}, {"id": "kk6", "islem": "kart_kapat", "kart": "K6A"}]
A += [kontrol("k0")]
# k0 — kapanıştan sonra, iadeden önce (Y24-2: bakiye / Kalan değişmez; gecikme günü min(vade, 08.10); gecikmiş v < bugün)
for c, no, f in (("P1", "KP1", "FP1"), ("P3", "KP3", "FP3"), ("P4", "KP4", "FP4")):
    cari_beklenen(E, "k0", c, 600, 0, 600)              # 900 − 300; 1. taksit ödendi, 2. / 3. taksit 08.10'da (bugün) — gecikmemiş
    kart_beklenen(E, "k0", no, 900, 300, 600, True)      # kapanış para değildir
    fatura_kartta(E, "k0", f, 600, 600)                  # kendi = kuyruk 0 + (900 − 300)
cari_beklenen(E, "k0", "P2", 900, 300, 900)              # 1. taksit 05.10 kendi vadesinde (S220) — 05.10 < 08.10 → gecikmiş 300
kart_beklenen(E, "k0", "KP2", 900, 0, 900, True)
fatura_kartta(E, "k0", "FP2", 900, 900)
cari_beklenen(E, "k0", "P5", 600, 0, 600)                # taksitli 900 − 300 (S50: 1. taksit); 2. / 3. taksit 08.10'da
E["k0:fatura:FP5:acik"] = 600 * TL
E["k0:kart:fatura:FP5:kapali"] = True
E["k0:kart:fatura:FP5:toplam"] = 900 * TL
E["k0:kart:fatura:FP5:kalan"] = 600 * TL
cari_beklenen(E, "k0", "P6", 1500, 600, 1500)            # K6A 1. taksit 05.10 (300) + K6B 1. taksit 01.10 (300) gecikmiş; faturalar kartların içinde (ayrıca sayılmaz)
kart_beklenen(E, "k0", "K6A", 900, 0, 900, True)
kart_beklenen(E, "k0", "K6B", 600, 0, 600)
fatura_kartta(E, "k0", "F6A", 900, 900)
fatura_kartta(E, "k0", "F6B", 600, 600)
cari_beklenen(E, "k0", "A4", 600, 0, 600)                # açık kart: 2. taksit 05.11 gelmedi
kart_beklenen(E, "k0", "KA4", 900, 300, 600)
fatura_kartta(E, "k0", "FA4", 600, 600)
A += [iade("ip1", "IP1", "FP1", 1, "2026-10-08"), iade("ip2", "IP2", "FP2", 1, "2026-10-08"), iade("ip3", "IP3", "FP3", 1, "2026-10-08"),
      {"id": "dz4", "islem": "fatura_duzenle", "fatura": "FP4", "adet": 2}, iade("ip5", "IP5", "FP5", 1, "2026-10-08"), iade("ip6", "IP6", "F6A", 1, "2026-10-08"),
      {"id": "dza4", "islem": "fatura_duzenle", "fatura": "FA4", "adet": 2}]
for x in ("ip1", "ip2", "ip3", "dz4", "ip5", "ip6", "dza4", "kk1", "kk2", "kk3", "kk4", "kk5", "kk6"):
    E["adim:%s:durum" % x] = "ok"
A += [kontrol("k1")]
# k1 — iade / Düzenle sonrası (Y24-3 … Y24-7)
for c, no, f, i in (("P1", "KP1", "FP1", "IP1"), ("P3", "KP3", "FP3", "IP3")):
    cari_beklenen(E, "k1", c, 300, 0, 300)               # S234: 900 − 300 − 300; 2. taksit (ilk AÇIK) 0'a; 3. taksit 08.10'da
    kart_beklenen(E, "k1", no, 600, 300, 300, True)      # S234 = A: Kalan 300
    fatura_kartta(E, "k1", f, 300, 300)                  # kendi = 0 + (600 − 300)
    E["k1:fatura:%s:acik" % i] = 0                       # iadenin tamamı küçülmeye (bağ) gitti — açık iade belgesi yok
    taksit_yok(Y, "k1", no)
cari_beklenen(E, "k1", "P2", 600, 0, 600)                # S237 = A: 1. taksit (05.10, kapanıştan önce gecikmiş, ilk AÇIK) 0'a → 08.10 gecikmişi 0
kart_beklenen(E, "k1", "KP2", 600, 0, 600, True)
fatura_kartta(E, "k1", "FP2", 600, 600)
E["k1:fatura:IP2:acik"] = 0
taksit_yok(Y, "k1", "KP2")
cari_beklenen(E, "k1", "P4", 300, 0, 300)                # Düzenle 900 → 600 (Δ 300 iade gibi): 2. taksit 0'a
kart_beklenen(E, "k1", "KP4", 600, 300, 300, True)
fatura_kartta(E, "k1", "FP4", 300, 300)
taksit_yok(Y, "k1", "KP4")
cari_beklenen(E, "k1", "P5", 300, 0, 300)                # kendi kartı: 2. taksit (ilk AÇIK) 0'a; 3. taksit 08.10'da
E["k1:fatura:FP5:acik"] = 300 * TL
E["k1:fatura:IP5:acik"] = 0
E["k1:kart:fatura:FP5:kapali"] = True
E["k1:kart:fatura:FP5:toplam"] = 600 * TL
E["k1:kart:fatura:FP5:kalan"] = 300 * TL
cari_beklenen(E, "k1", "P6", 1200, 300, 1200)            # yalnız K6A küçülür (1. taksit 0'a); K6B 1. taksit 01.10 gecikmiş 300
kart_beklenen(E, "k1", "K6A", 600, 0, 600, True)
kart_beklenen(E, "k1", "K6B", 600, 0, 600)
fatura_kartta(E, "k1", "F6A", 600, 600)
fatura_kartta(E, "k1", "F6B", 600, 600)
E["k1:fatura:IP6:acik"] = 0
taksit_yok(Y, "k1", "K6A")
cari_beklenen(E, "k1", "A4", 300, 0, 300)                # açık kart Düzenle: 2. taksit 0'a, 3. taksit 05.12
kart_beklenen(E, "k1", "KA4", 600, 300, 300)
fatura_kartta(E, "k1", "FA4", 300, 300)
taksit_yok(Y, "k1", "KA4")
A += [{"id": "ii3", "islem": "fatura_iptal", "fatura": "IP3"}, {"id": "ya1", "islem": "kart_yeniden_ac", "kart": "KP1"}, kontrol("k2")]
E["adim:ii3:durum"] = "ok"
E["adim:ya1:durum"] = "ok"
# k2 — iade iptali (Y24-5: küçülmenin tersi — 2. taksit geri gelir) + Yeniden Aç (Y24-3: Kalan küçülmüş)
cari_beklenen(E, "k2", "P3", 600, 0, 600)
kart_beklenen(E, "k2", "KP3", 900, 300, 600, True)
fatura_kartta(E, "k2", "FP3", 600, 600)
E["k2:fatura:IP3:durum"] = "iptal"
for i, v in enumerate((300, 0, 0)):
    E["k2:kart:KP3:taksit%d:odenen" % (i + 1)] = v * TL
cari_beklenen(E, "k2", "P1", 300, 0, 300)                # açık kart: 3. taksit 05.12 gelmedi
kart_beklenen(E, "k2", "KP1", 600, 300, 300, False)
A += [{"id": "kk1b", "islem": "kart_kapat", "kart": "KP1"}, kontrol("k3")]
E["adim:kk1b:durum"] = "ok"
cari_beklenen(E, "k3", "P1", 300, 0, 300)                # Kartı Kapat onayı küçülmüş kalanla (KAPSAM (a))
kart_beklenen(E, "k3", "KP1", 600, 300, 300, True)
E["k3:kasa"] = 1500 * TL                                 # tahsilatlar 5 × 300; kapanış / iade / Düzenle Kasa'ya dokunmaz
E["k1:kasa"] = 1500 * TL
yaz("d53-c5-s234-kapali-kart-iade", {
    "dil": "destekofis-cari/3", "ad": "d53-c5-s234-kapali-kart-iade",
    "aciklama": "Bakım 24 (§36): Borçta Kalsın ile KAPATILMIŞ Mevcut Borç kartı (Kartı Kapat bugün) + içine aldığı faturanın iadesi (S234 = A — kararın örneği P1; S237 = A — kararın örneği P2: kapanıştan önce "
                "vadesi geçmiş taksit, aynı gün iade, kapanış günü gecikmişi 0), iade iptali (P3 — küçülmenin tersi), Düzenle ile azaltma (P4; açık kartta A4), kendi kartlı (taksitli) fatura (P5), aynı caride iki "
                "kart (P6), Yeniden Aç / yeniden Kartı Kapat — onay tutarı küçülmüş Kalan (P1 k2 / k3). Elle tablo karar metinlerinden, kâhin koşulmadan (üreteç docs/kanit/2026-11-21/kahin-cari24-arac/uret-d53.py).",
    "dayanak": "KARARLAR.md §36 (Y24-1 … Y24-7), §35 (Y23-2 / Y23-3), §33 Y21b-6, §34 Y22-4, §17 (4) 2B-S3 = A",
    "bugun": "2026-10-08", "elleBeklenen": E, "elleYok": Y, "adimlar": A})

# ───────────────────────── d54: AÇIK kart — karar (4) (aynı senaryolar, kapanış yok; bugün 08.10.2026)
A = []
E, Y = {}, []
A += [cari("ca1", "A1", "Ahu Açık Kart"), fatura("fa1", "FA1", "A1", 900, 3, "2026-09-01"), kart("ka1", "KA1", "A1", 900, 3, "2026-10-05", "2026-09-02"), kt("ta1", "KA1", 300, "2026-09-03")]
A += [cari("ca2", "A2", "Ayten Gecikmiş Taksit"), fatura("fa2", "FA2", "A2", 900, 3, "2026-09-01"), kart("ka2", "KA2", "A2", 900, 3, "2026-10-05", "2026-09-02")]
A += [cari("ca3", "A3", "Arda İade İptali"), fatura("fa3", "FA3", "A3", 900, 3, "2026-09-01"), kart("ka3", "KA3", "A3", 900, 3, "2026-10-05", "2026-09-02"), kt("ta3", "KA3", 300, "2026-09-03")]
A += [cari("ca5", "A5", "Ayşe Kendi Kartı"), fatura("fa5", "FA5", "A5", 900, 3, "2026-09-01", {"sayi": 3, "ilkVade": "2026-09-05"}),
      {"id": "ta5", "islem": "tahsilat", "cari": "A5", "tutar": "300", "tarih": "2026-09-03"}]
A += [cari("ca6", "A6", "Alp İki Kart"), fatura("fa6a", "G6A", "A6", 900, 3, "2026-09-01"), kart("ka6a", "L6A", "A6", 900, 3, "2026-10-05", "2026-09-02"),
      fatura("fa6b", "G6B", "A6", 600, 2, "2026-09-03"), kart("ka6b", "L6B", "A6", 600, 2, "2026-10-01", "2026-09-04")]
A += [kontrol("k0")]
cari_beklenen(E, "k0", "A1", 600, 0, 600)
kart_beklenen(E, "k0", "KA1", 900, 300, 600)
cari_beklenen(E, "k0", "A2", 900, 300, 900)              # 1. taksit 05.10 gecikmiş
kart_beklenen(E, "k0", "KA2", 900, 0, 900)
cari_beklenen(E, "k0", "A5", 600, 300, 600)              # taksitli: 1. taksit (05.09) S50 ile ödendi, 2. taksit 05.10 gecikmiş 300, 3. taksit 05.11
E["k0:fatura:FA5:acik"] = 600 * TL
cari_beklenen(E, "k0", "A6", 1500, 600, 1500)
A += [iade("ia1", "IA1", "FA1", 1, "2026-10-08"), iade("ia2", "IA2", "FA2", 1, "2026-10-08"), iade("ia3", "IA3", "FA3", 1, "2026-10-08"),
      iade("ia5", "IA5", "FA5", 1, "2026-10-08"), iade("ia6", "IA6", "G6A", 1, "2026-10-08"), kontrol("k1")]
for x in ("ia1", "ia2", "ia3", "ia5", "ia6"):
    E["adim:%s:durum" % x] = "ok"
for c, no, f, i in (("A1", "KA1", "FA1", "IA1"), ("A3", "KA3", "FA3", "IA3")):
    cari_beklenen(E, "k1", c, 300, 0, 300)               # karar (4): 2. taksit (ilk AÇIK) 0'a
    kart_beklenen(E, "k1", no, 600, 300, 300)
    fatura_kartta(E, "k1", f, 300, 300)
    E["k1:fatura:%s:acik" % i] = 0
    taksit_yok(Y, "k1", no)
cari_beklenen(E, "k1", "A2", 600, 0, 600)                # karar (4) / S237 "açık kartta da böyle": 1. taksit (05.10, ilk AÇIK) 0'a
kart_beklenen(E, "k1", "KA2", 600, 0, 600)
fatura_kartta(E, "k1", "FA2", 600, 600)
taksit_yok(Y, "k1", "KA2")
cari_beklenen(E, "k1", "A5", 300, 0, 300)                # kendi kartı: 2. taksit (05.10, ilk AÇIK) 0'a; 3. taksit 05.11 gelmedi
E["k1:fatura:FA5:acik"] = 300 * TL
E["k1:fatura:IA5:acik"] = 0
cari_beklenen(E, "k1", "A6", 1200, 300, 1200)            # yalnız L6A küçülür (1. taksit 05.10 → 0); L6B 1. taksit 01.10 gecikmiş
kart_beklenen(E, "k1", "L6A", 600, 0, 600)
kart_beklenen(E, "k1", "L6B", 600, 0, 600)
fatura_kartta(E, "k1", "G6A", 600, 600)
fatura_kartta(E, "k1", "G6B", 600, 600)
taksit_yok(Y, "k1", "L6A")
A += [{"id": "iia3", "islem": "fatura_iptal", "fatura": "IA3"}, kontrol("k2")]
E["adim:iia3:durum"] = "ok"
cari_beklenen(E, "k2", "A3", 600, 0, 600)                # Y24-5: 2. taksit geri gelir (05.11 — gelmedi)
kart_beklenen(E, "k2", "KA3", 900, 300, 600)
fatura_kartta(E, "k2", "FA3", 600, 600)
E["k2:fatura:IA3:durum"] = "iptal"
for i, v in enumerate((300, 0, 0)):
    E["k2:kart:KA3:taksit%d:odenen" % (i + 1)] = v * TL
E["k2:kasa"] = 900 * TL
yaz("d54-c5-s234-acik-kart-iade", {
    "dil": "destekofis-cari/3", "ad": "d54-c5-s234-acik-kart-iade",
    "aciklama": "Bakım 24 (§36): AÇIK Mevcut Borç kartında karar (4) 2B-S3 = A — içine aldığı faturanın iadesi kartı vadesi en önce gelen açık taksitten küçültür (A1 S234'ün açık eşi, A2 S237'nin açık eşi — "
                "vadesi geçmiş taksit, A3 iade iptali, A5 kendi kartlı fatura, A6 iki kart). Yeni dil adımı YOK (eski kâhin de koşar). Elle tablo karar metinlerinden, kâhin koşulmadan.",
    "dayanak": "KARARLAR.md §36 (Y24-3 … Y24-5, Y24-7), §17 (4) 2B-S3 = A, §35",
    "bugun": "2026-10-08", "elleBeklenen": E, "elleYok": Y, "adimlar": A})

# ───────────────────────── d55: açık kart — iade iptalinde geri gelen taksit kendi vadesiyle gecikmişe (bugün 20.11.2026) + küçülme açık kalanı aşınca fazlası avans
A = []
E, Y = {}, []
A += [cari("cb1", "B1", "Bora Geri Gelen Taksit"), fatura("fb1", "FB1", "B1", 900, 3, "2026-09-01"), kart("kb1", "KB1", "B1", 900, 3, "2026-10-05", "2026-09-02"), kt("tb1", "KB1", 300, "2026-09-03")]
A += [cari("cb2", "B2", "Berk Fazlası Avans"), fatura("fb2", "FB2", "B2", 900, 3, "2026-09-01"), kart("kb2", "KB2", "B2", 900, 3, "2026-10-05", "2026-09-02"), kt("tb2", "KB2", 600, "2026-09-03")]
A += [kontrol("k0")]
cari_beklenen(E, "k0", "B1", 600, 300, 600)              # 2. taksit 05.11 < 20.11 gecikmiş; 3. taksit 05.12
kart_beklenen(E, "k0", "KB1", 900, 300, 600)
cari_beklenen(E, "k0", "B2", 300, 0, 300)                # 1. / 2. taksit ödendi; 3. taksit 05.12
kart_beklenen(E, "k0", "KB2", 900, 600, 300)
A += [iade("ib1", "IB1", "FB1", 1, "2026-11-10"), iade("ib2", "IB2", "FB2", 2, "2026-11-10"), kontrol("k1")]
E["adim:ib1:durum"] = "ok"
E["adim:ib2:durum"] = "ok"
cari_beklenen(E, "k1", "B1", 300, 0, 300)                # (4): 2. taksit (05.11, ilk AÇIK) 0'a
kart_beklenen(E, "k1", "KB1", 600, 300, 300)
fatura_kartta(E, "k1", "FB1", 300, 300)
taksit_yok(Y, "k1", "KB1")
cari_beklenen(E, "k1", "B2", -300, 0, -300)              # (4) "küçülme kartın açık kalanını aşarsa fazlası carinin avansı": iade 600, açık 300 → kart 600, fazlası 300 avans; bakiye 900 − 600 − 600
kart_beklenen(E, "k1", "KB2", 600, 600, 0)
E["k1:fatura:FB2:acik"] = 0                              # kendi = 0 + (600 − 600); 'Taksitte' Y23-6 (i) SUS
E["k1:fatura:FB2:gosterilen"] = 0
E["k1:fatura:FB2:kartta"] = 0
E["k1:fatura:IB2:acik"] = 300 * TL                       # iadenin avansa giden fazlası açık iade belgesi (Σ açık = 0 − 300 = bakiye)
Y.append("k1:fatura:FB2:taksitte")
taksit_yok(Y, "k1", "KB2")
A += [{"id": "iib1", "islem": "fatura_iptal", "fatura": "IB1"}, kontrol("k2")]
E["adim:iib1:durum"] = "ok"
cari_beklenen(E, "k2", "B1", 600, 300, 600)              # Y24-5: 2. taksit AYNI taksitte geri gelir (05.11 < 20.11 → gecikmiş 300)
kart_beklenen(E, "k2", "KB1", 900, 300, 600)
fatura_kartta(E, "k2", "FB1", 600, 600)
E["k2:fatura:IB1:durum"] = "iptal"
for i, v in enumerate((300, 0, 0)):
    E["k2:kart:KB1:taksit%d:odenen" % (i + 1)] = v * TL
E["k2:kasa"] = 900 * TL
yaz("d55-c5-s234-iade-iptal-gecikmis", {
    "dil": "destekofis-cari/3", "ad": "d55-c5-s234-iade-iptal-gecikmis",
    "aciklama": "Bakım 24 (§36): açık kartta iade iptali — küçülmenin tersi, geri gelen taksit KENDİ vadesiyle gecikmişe girer (B1; bugün 20.11.2026, taksit 05.11); karar (4)'ün 'küçülme kartın açık kalanını "
                "aşarsa fazlası carinin avansı' kolu (B2). Yeni dil adımı YOK. Elle tablo karar metinlerinden, kâhin koşulmadan.",
    "dayanak": "KARARLAR.md §36 (Y24-3, Y24-5), §17 (4) 2B-S3 = A",
    "bugun": "2026-11-20", "elleBeklenen": E, "elleYok": Y, "adimlar": A})
print("yazıldı: d53 / d54 / d55")
