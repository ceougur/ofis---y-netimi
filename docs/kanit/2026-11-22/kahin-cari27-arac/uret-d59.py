#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Cari kâhini bakımı 27 (§39): (1) d57 K3 ve d58 T1 / T2 / T3 / R4'ün elle tablolarını kararlara göre DEĞİŞTİRİR (adımlar değişmez), (2) yeni d59 elle senaryosunu yazar.
Elle beklenenler KARAR METİNLERİNDEN (girdi §1–§3: S249 = A, S251 = A, S250 = C) ve §39'un yorumlarından (Y27-1 … Y27-6), kâhin KOŞULMADAN elle hesaplandı (her satırın yanında hesap);
model.py'nin çıktısından TÜRETİLMEZ (ders 5, 40). Bakım 26'nın üreteci (kahin-cari26-arac/uret-d58.py) yardımcılarının kopyası. Kullanım: python3 -I uret-d59.py <senaryolar klasörü>"""
import json
import os
import sys

HEDEF = sys.argv[1]
TL = 100  # kuruş


def oku(ad):
    with open(os.path.join(HEDEF, ad + ".json"), encoding="utf-8") as f:
        return json.load(f)


def yaz(ad, sen):
    with open(os.path.join(HEDEF, ad + ".json"), "w", encoding="utf-8") as f:
        json.dump(sen, f, ensure_ascii=False, indent=1)
        f.write("\n")


E, Y, B = {}, [], []


def cr(k, c, bakiye, gecikmis, acik=None, esit=True):
    E["%s:cari:%s:bakiye" % (k, c)] = bakiye * TL
    if gecikmis is None:
        Y.append("%s:cari:%s:gecikmis" % (k, c))
    else:
        E["%s:cari:%s:gecikmis" % (k, c)] = gecikmis * TL
    if acik is not None:
        E["%s:cari:%s:acikToplam" % (k, c)] = acik * TL
        E["%s:cari:%s:acikEsitBakiye" % (k, c)] = esit


def kr(k, no, toplam, odenen, kalan, kapali=None):
    E["%s:kart:%s:var" % (k, no)] = True
    E["%s:kart:%s:mevcutBorc" % (k, no)] = True
    E["%s:kart:%s:toplam" % (k, no)] = toplam * TL
    E["%s:kart:%s:odenen" % (k, no)] = odenen * TL
    E["%s:kart:%s:kalan" % (k, no)] = kalan * TL
    if kapali is not None:
        E["%s:kart:%s:kapali" % (k, no)] = kapali


def ft(k, f, acik):
    E["%s:fatura:%s:acik" % (k, f)] = acik * TL


def fk(k, f, toplam, kalan, kapali=None):
    E["%s:kart:fatura:%s:toplam" % (k, f)] = toplam * TL
    E["%s:kart:fatura:%s:kalan" % (k, f)] = kalan * TL
    if kapali is not None:
        E["%s:kart:fatura:%s:kapali" % (k, f)] = kapali


def sus_kendi(k, c, f, neden):
    """Y27-2 (SK-51; bakım 26'nın Y26-4 / Y26-5 düzeni): carinin kuyruğu ve kendi kartının göstergeleri SUS (bakiye ayrıca değerle)."""
    Y.extend(["%s:cari:%s:gecikmis" % (k, c), "%s:cari:%s:acikToplam" % (k, c), "%s:cari:%s:acikEsitBakiye" % (k, c), "%s:fatura:%s:acik" % (k, f),
              "%s:kart:fatura:%s:toplam" % (k, f), "%s:kart:fatura:%s:kalan" % (k, f), "%s:kart:fatura:%s:kapali" % (k, f)])
    B.append(neden)


def ok(*ids):
    for i in ids:
        E["adim:%s:durum" % i] = "ok"


def degistir(sen, sil_anahtar, yeni_E, yeni_Y, sil_B=(), yeni_B=()):
    eb = {k: v for k, v in sen["elleBeklenen"].items() if not sil_anahtar(k)}
    eb.update(yeni_E)
    sen["elleBeklenen"] = eb
    sen["elleYok"] = [y for y in sen.get("elleYok", []) if not sil_anahtar(y)] + list(yeni_Y)
    bel = list(sen.get("elleBelirsiz", []))
    for x in sil_B:  # her biri BİR kez çıkar (aynı kod birden çok caride olabilir)
        bel.remove(x)
    sen["elleBelirsiz"] = bel + list(yeni_B)


# ───────────────────────── (1a) d57 K3 — S249 = A kararın KENDİ örneği (bugün 20.11.2026)
d57 = oku("d57-c5-s241-s242-duzenle")
E, Y, B = {}, [], []
# fatura 900 (3 adet; kendi kartı 3 × 300 — 05.10 / 05.11 / 05.12), 03.09 tahsilat 600 (kart seçilmeden — tek kuyruk; ANINDA C13.4 (4): o gün açık 05.10 300 + 05.11 300), Düzenle 3 → 1 adet (300)
#   → kendi kartı yeniden kurulur 3 × 100 (300); tahsilat 600 → 05.10 100 + 05.11 100 + 05.12 100 (Kalan 0), artan 300 = carinin avansı; bakiye 300 − 600 = −300; gecikmiş 0;
#   açık toplamı Σ fatura açığı = 0 (avans açık toplamına girmez — d57 K1 ile aynı tanım) → acikEsitBakiye false; kart açık (Kartı Kapat yok)
cr("k1", "K3", -300, 0, 0, False); ft("k1", "FK3", 0); fk("k1", "FK3", 300, 0, False)
degistir(d57, lambda k: k.startswith("k1:") and (":K3:" in k or ":FK3:" in k), E, Y, sil_B=("SK-48",))
d57["aciklama"] = d57["aciklama"] if "bakım 27" in d57["aciklama"] else d57["aciklama"].replace("K3 kendi kartlı faturada — bakım 26: §2 SUS, SK-48", "K3 kendi kartlı faturada — bakım 27: S249 = A kararın örneği, kart 3 × 100 yeniden kurulur, fazla 300 avans")
d57["dayanak"] += "" if "§39" in d57["dayanak"] else ", §39 Y27-1"
yaz(d57["ad"], d57)
n57 = (len(E), len(Y))

# ───────────────────────── (1b) d58 T1 / T2 / T3 (S249 = A) ve R4 (S251 = A) (bugün 08.10.2026; plan 3 taksit, ilk vade 05.10 → 05.10 / 05.11 / 05.12)
d58 = oku("d58-c5-s246-s243-kendi-kart-duzenle")
E, Y, B = {}, [], []
# T1 — (a) ödemeli: fatura 900, 03.09 tahsilat 300 (ANINDA → 05.10 300), Düzenle 3 → 2 (600) → kart 3 × 200; tahsilat 300 → 05.10 200 + 05.11 100; Kalan 05.11 100 + 05.12 200 = 300;
#   08.10 gecikmişi 0 (05.10 kapalı; 05.11 gelmedi); bakiye 600 − 300 = 300; fatura açığı 300; açık toplamı 300 = bakiye
cr("k1", "T1", 300, 0, 300); ft("k1", "FT1", 300); fk("k1", "FT1", 600, 300, False)
# T2 — (b) Borçta Kalsın ile kapanmış (08.10), tahsilatsız: S235 = B → kart AÇIK kurulur 3 × 200; 08.10 gecikmişi 05.10 200; bakiye 600; Kalan 600
cr("k1", "T2", 600, 200, 600); ft("k1", "FT2", 600); fk("k1", "FT2", 600, 600, False)
# T3 — (c) açık, tahsilatsız (kararın "900 → 600 ise kart 3 × 200" sözü): kart 3 × 200; 08.10 gecikmişi 05.10 200; bakiye 600 (bakım 26'da 0 / 300 / 300 → gecikmiş 0 idi — P-1)
cr("k1", "T3", 600, 200, 600); ft("k1", "FT3", 600); fk("k1", "FT3", 600, 600, False)
# R4 — S251 = A: fatura 900 (3 adet), 10.09 iade 1 adet (300 — 05.10 taksiti 0'a; Y24-4), Düzenle 3 → 4 adet REDDEDİLİR; hiçbir şey değişmez:
#   bakiye 900 − 300 = 600; kendi kartı 0 / 300 / 300 = 600, Kalan 600, açık; 08.10 gecikmişi 0 (05.10 taksiti 0; 05.11 gelmedi); fatura açığı 600; iade belgesinin açığı 0; açık toplamı 600
E["adim:dr4:durum"] = "ret"
cr("k1", "R4", 600, 0, 600); ft("k1", "FR4", 600); E["k1:fatura:IR4:acik"] = 0; fk("k1", "FR4", 600, 600, False)
degistir(d58, lambda k: (k.startswith("k1:") and any(x in k for x in (":T1:", ":FT1:", ":T2:", ":FT2:", ":T3:", ":FT3:", ":R4:", ":FR4:", ":IR4:"))) or k == "adim:dr4:durum",
         E, Y, sil_B=("SK-48", "SK-48", "SK-50", "SK-49"))
d58["aciklama"] = d58["aciklama"] if "bakım 27" in d58["aciklama"] else d58["aciklama"].replace(
    "azaltma §2 SUS SK-48 (T1 ödemeli, T2 kapanmış tahsilatsız), açık tahsilatsız azaltma §36 KAPSAM (b) + (e) (T3)",
    "azaltma — bakım 27: S249 = A, kart Düzenle'nin planıyla yeniden kurulur (T1 ödemeli, T2 kapanmış tahsilatsız — AÇIK kurulur, T3 açık tahsilatsız); R4 — bakım 27: S251 = A, iadeli faturanın Düzenle'si reddedilir")
d58["dayanak"] += "" if "§39" in d58["dayanak"] else ", §39 Y27-1 / Y27-3"
yaz(d58["ad"], d58)
n58 = (len(E), len(Y))

# ───────────────────────── (2) d59 — S249 = A kolları, SK-51 SUS, S251 = A (taksitli / Mevcut Borç kartlı / kartsız; iade iptalinden sonra olağan kural) (bugün 20.10.2026)
E, Y, B = {}, [], []
A = []
T3 = {"sayi": 3, "ilkVade": "2026-10-05"}


def cari(id_, ad, isim, tarih="2026-09-01"):
    return {"id": id_, "islem": "cari_ac", "ad": ad, "isim": isim, "tarih": tarih}


def fatura(id_, ad, c, tutar, adet, tarih, taksit=None):
    a = {"id": id_, "islem": "fatura", "ad": ad, "cari": c, "tur": "satis", "tutar": str(tutar), "adet": adet, "tarih": tarih}
    if taksit:
        a["taksit"] = taksit
    return a


def tah(id_, c, tutar, tarih):
    return {"id": id_, "islem": "tahsilat", "cari": c, "tutar": str(tutar), "tarih": tarih}


# numaralı belgeler (satış faturası, iade) senaryo içinde tarih sırasıyla (§19 Y7-1): önce 01.09 faturaları, sonra 10.09 fatura ve iadeleri
A += [cari("cu1", "U1", "Umut Tam Ödemeli Azaltma"), fatura("fu1", "FU1", "U1", 900, 3, "2026-09-01", T3), tah("tu1", "U1", 600, "2026-09-03")]
A += [cari("cu2", "U2", "Ufuk Avans Sonraki Faturaya"), fatura("fu2", "FU2", "U2", 900, 3, "2026-09-01", T3), tah("tu2", "U2", 600, "2026-09-03")]
A += [cari("cu3", "U3", "Uğur Kapalı Ödemeli Azaltma"), fatura("fu3", "FU3", "U3", 900, 3, "2026-09-01", T3), tah("tu3", "U3", 300, "2026-09-03"),
      {"id": "kku3", "islem": "kart_kapat", "fatura": "FU3"}]
A += [cari("cu4", "U4", "Ulaş Kapalı Kart Azaltma"), fatura("fu4", "FU4", "U4", 900, 3, "2026-09-01", T3), {"id": "kku4", "islem": "kart_kapat", "fatura": "FU4"}]
A += [cari("cu5", "U5", "Ümran İadeli Mevcut Borç"), fatura("fu5", "FU5", "U5", 900, 3, "2026-09-01"),
      {"id": "ku5", "islem": "kart_ac", "ad": "KU5", "cari": "U5", "tutar": "900", "taksit": 3, "ilkVade": "2026-10-05", "tarih": "2026-09-02", "mevcut": True}]
A += [cari("cu6", "U6", "Ülkü İadeli Kartsız"), fatura("fu6", "FU6", "U6", 600, 2, "2026-09-01")]
A += [cari("cu7", "U7", "Utku İade İptali Sonra Düzenle"), fatura("fu7", "FU7", "U7", 900, 3, "2026-09-01", T3)]
A += [fatura("gu2", "GU2", "U2", 200, 1, "2026-09-10")]  # U2: 10.09 taksitsiz fatura (vade = belge günü)
A += [{"id": "iu5", "islem": "iade", "ad": "IU5", "fatura": "FU5", "adet": 1, "tarih": "2026-09-10"},
      {"id": "iu6", "islem": "iade", "ad": "IU6", "fatura": "FU6", "adet": 1, "tarih": "2026-09-10"},
      {"id": "iu7", "islem": "iade", "ad": "IU7", "fatura": "FU7", "adet": 1, "tarih": "2026-09-10"}]
A += [{"id": "k0", "islem": "kontrol", "gecikmis": True, "acikToplam": True}]
# k0 (bugün 20.10; Düzenle'den önce)
# U1: 03.09 tahsilat 600 → 05.10 300 + 05.11 300; açık 05.12 300 (gelmedi) → bakiye 300, gecikmiş 0
cr("k0", "U1", 300, 0, 300); ft("k0", "FU1", 300)
# U2: 03.09 tahsilat 600 (ANINDA, C13.4 (4)) → FU2 05.10 300 + 05.11 300 (o gün açık kalemler; artan yok); GU2 10.09 doğar, açık 200 (vade 10.09 — gecikmiş); FU2 05.12 300 gelmedi
#   → bakiye 900 + 200 − 600 = 500; gecikmiş 200; FU2 açığı 300; GU2 açığı 200; açık toplamı 500
cr("k0", "U2", 500, 200, 500); ft("k0", "FU2", 300); ft("k0", "GU2", 200)
# U3: kapanış bugün (20.10): tahsilat 300 → 05.10; açık 05.11 / 05.12 gecikme günü min(vade, 20.10) = bugün → gecikmiş 0; kart 900, Kalan 600, kapalı; bakiye 600
cr("k0", "U3", 600, 0, 600); ft("k0", "FU3", 600); fk("k0", "FU3", 900, 600, True)
# U4: kapanış bugün, tahsilatsız: 05.10 300 gecikmiş (kendi vadesi), öbürleri bugün → gecikmiş 300; kart 900 / 900, kapalı; bakiye 900
cr("k0", "U4", 900, 300, 900); ft("k0", "FU4", 900); fk("k0", "FU4", 900, 900, True)
# U5: fatura 900 tamamen Mevcut Borç kartında (02.09, 3 × 300); 10.09 iade 300 → dış açık 0, karar (4) ile kart vadesi en önce gelen açık taksitten küçülür: 05.10 300 → 0
#   → kart 600 (0 / 300 / 300), ödenen 0, Kalan 600; gecikmiş 0 (05.10 taksiti 0; 05.11 gelmedi); fatura açığı 900 − 300 = 600; iade belgesinin açığı 0; bakiye 600
cr("k0", "U5", 600, 0, 600); kr("k0", "KU5", 600, 0, 600); ft("k0", "FU5", 600); E["k0:fatura:IU5:acik"] = 0
# U6: kartsız fatura 600 (2 adet), 10.09 iade 1 adet (300) → bakiye 300; fatura açığı 300 (vade 01.09 — gecikmiş 300); iade belgesinin açığı 0
cr("k0", "U6", 300, 300, 300); ft("k0", "FU6", 300); E["k0:fatura:IU6:acik"] = 0
# U7: taksitli 900, 10.09 iade 1 adet → kendi kartı 0 / 300 / 300 (Y24-4); gecikmiş 0; bakiye 600
cr("k0", "U7", 600, 0, 600); ft("k0", "FU7", 600); E["k0:fatura:IU7:acik"] = 0
A += [{"id": "du1", "islem": "fatura_duzenle", "fatura": "FU1", "adet": 2}, {"id": "du2", "islem": "fatura_duzenle", "fatura": "FU2", "adet": 1},
      {"id": "du3", "islem": "fatura_duzenle", "fatura": "FU3", "adet": 2}, {"id": "du4", "islem": "fatura_duzenle", "fatura": "FU4", "adet": 1},
      {"id": "du5", "islem": "fatura_duzenle", "fatura": "FU5", "adet": 2}, {"id": "du6", "islem": "fatura_duzenle", "fatura": "FU6", "adet": 1},
      {"id": "iiu7", "islem": "fatura_iptal", "fatura": "IU7"}, {"id": "du7", "islem": "fatura_duzenle", "fatura": "FU7", "adet": 2},
      {"id": "k1", "islem": "kontrol", "gecikmis": True, "acikToplam": True}]
ok("du1", "du2", "du3", "du4", "iiu7", "du7")
# k1
# U1 — (a) ödeme = yeni tutar: 900 → 600, kart 3 × 200; tahsilat 600 → üç taksit kapalı, Kalan 0, artan 0; bakiye 0; gecikmiş 0; açık toplamı 0 = bakiye
cr("k1", "U1", 0, 0, 0); ft("k1", "FU1", 0); fk("k1", "FU1", 600, 0, False)
# U2 — (a) fazla ödeme avans ve sonraki kalem: 900 → 300, kart 3 × 100; 03.09 tahsilat 600 → 05.10 / 05.11 / 05.12 100'er, artan 300 avans (C13.4 (4)); GU2 10.09 doğunca avanstan 200 kapanır,
#   avans 100 kalır → bakiye 300 + 200 − 600 = −100; gecikmiş 0; FU2 / GU2 açığı 0; açık toplamı 0 ≠ bakiye → acikEsitBakiye false; kart 300 / Kalan 0, açık
cr("k1", "U2", -100, 0, 0, False); ft("k1", "FU2", 0); ft("k1", "GU2", 0); fk("k1", "FU2", 300, 0, False)
# U3 — SK-51 (UÇ) SUS: kapanmış + ödemeli kendi kartında azaltma — bakiye 600 − 300 = 300 (her okumada); kart / kuyruk yazılmaz
E["k1:cari:U3:bakiye"] = 300 * TL; sus_kendi("k1", "U3", "FU3", "SK-51")
# U4 — (b) kapanmış tahsilatsız, kararın örneğinin tutarı (900 → 300): S235 = B → kart AÇIK 3 × 100; 20.10 gecikmişi 05.10 100; Kalan 300; bakiye 300
cr("k1", "U4", 300, 100, 300); ft("k1", "FU4", 300); fk("k1", "FU4", 300, 300, False)
# U5 — S251 = A (Mevcut Borç kartlı faturada da): Düzenle 3 → 2 REDDEDİLİR; k0'daki sayılar AYNEN
E["adim:du5:durum"] = "ret"
cr("k1", "U5", 600, 0, 600); kr("k1", "KU5", 600, 0, 600); ft("k1", "FU5", 600); E["k1:fatura:IU5:acik"] = 0
# U6 — S251 = A (kartsız faturada da): Düzenle 2 → 1 REDDEDİLİR; k0'daki sayılar AYNEN
E["adim:du6:durum"] = "ret"
cr("k1", "U6", 300, 300, 300); ft("k1", "FU6", 300); E["k1:fatura:IU6:acik"] = 0
# U7 — iade iptali (KAPSAM (c): küçülme geri alınır → 300 / 300 / 300, bakiye 900), sonra Düzenle 3 → 2 olağan kuralla (S251 KAPSAM: S249 (c)) → kart 3 × 200, açık;
#   20.10 gecikmişi 05.10 200; Kalan 600; bakiye 600; iade belgesi iptal
cr("k1", "U7", 600, 200, 600); ft("k1", "FU7", 600); fk("k1", "FU7", 600, 600, False); E["k1:fatura:IU7:durum"] = "iptal"
d59 = {"dil": "destekofis-cari/3", "ad": "d59-c5-s249-s251-kendi-kart-azaltma-iadeli-duzenle",
       "aciklama": "Bakım 27 (§39): S249 = A kendi kartında Düzenle ile azaltma — ödeme yeni tutara eşit (U1), fazla ödeme avans ve sonraki faturayı kapatır (U2), kapanmış tahsilatsız kart kararın 900 → 300 tutarıyla AÇIK kurulur (U4); "
                   "SK-51 SUS — kapanmış + ödemeli kartta azaltma (U3); S251 = A iadeli faturanın Düzenle'si reddedilir — Mevcut Borç kartlı (U5), kartsız (U6); iade iptalinden sonra Düzenle olağan kuralla (U7). Bugün 20.10.2026. "
                   "Elle tablo karar metinlerinden, kâhin koşulmadan (üreteç docs/kanit/2026-11-22/kahin-cari27-arac/uret-d59.py).",
       "dayanak": "KARARLAR.md §39 (Y27-1 … Y27-3), §38 Y26-2, §36 Y24-2 / Y24-3 / Y24-4, C13.4 (4)", "bugun": "2026-10-20",
       "elleBeklenen": dict(E), "elleYok": list(Y), "elleBelirsiz": list(B), "adimlar": A}
yaz(d59["ad"], d59)
print("d57 (K3) elle %d + elleYok %d · d58 (T1 / T2 / T3 / R4) elle %d + elleYok %d · d59 elle %d + elleYok %d + belirsiz %d" % (n57 + n58 + (len(E), len(Y), len(B))))
