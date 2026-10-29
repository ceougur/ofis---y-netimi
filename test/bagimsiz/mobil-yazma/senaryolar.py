#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""M5 mobil yazma kâhini — senaryolar ve kabul kümesi.

  python3 -I senaryolar.py                 # kabul.json'u yeniden üretir (model ≠ elle beklenti ya da ≠ üretici akış beklentisi → YAZMAZ, çıkış 1)
  python3 -I senaryolar.py --denetle       # yalnız denetim, dosya yazılmaz
  python3 -I senaryolar.py --olay 5000     # rastgele senaryoları bu hacimle üretip yalnız denetler (dosya yazılmaz)
  python3 -I senaryolar.py --senaryo <ad>  # tek senaryonun JSON'unu yazar (sürücü için)

Elle senaryoların beklenenleri ELLE yazıldı (karar metninden; modelin çıktısından kopyalanmadı). Taban beklenen her parametrenin İLK
değerindeki dünyadır (kahin.PARAMETRELER sırası); öbür değerlerin etkisi "pg" (parametreye göre) üzerine yazmalarıdır. Eşdeğerlik çiftlerinde
masaüstü senaryosunun beklenen değeri, mobil senaryonun ESDEGER birleşimindeki (mobil kısıtları kalkmış) elle değeridir — ayrı yazılmaz: "aynı iş
masaüstünden ve mobilden girilince aynı sayılar" iddiası tam olarak budur.

Rastgele senaryolar (tohum 1–3): üretici olayları üretirken kendi BAĞIMSIZ akış modeliyle (Akis — kahin.py'yi ve cari kâhinini KULLANMAZ;
FIFO'yu kendisi yapar) beklenen çıktıyı 10 birleşimde (öneri, her parametre tek tek ters, hepsi ters) hesaplar.
"""
import copy
import importlib.util
import itertools
import json
import os
import random
import sys
from datetime import date, datetime, timedelta

sys.dont_write_bytecode = True
_BURASI = os.path.dirname(os.path.abspath(__file__))


def _yukle(ad):
    spec = importlib.util.spec_from_file_location("mobil_" + ad, os.path.join(_BURASI, ad + ".py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


kahin = _yukle("kahin")
P = kahin.PARAMETRELER
ILK = {k: v[0] for k, v in P.items()}
# Masaüstü eşdeğeri: mobilin bütün yolları açık (Kapatılacak Fatura, çek/senet, taksit kartı, onaylar, stok çıkışı). Tarih ve geç gönderim seçimleri
# çift senaryolarında sonucu değiştirmez (adımlar formun açıldığı gün gönderilir).
ESDEGER = {"kapatilacak": "secilir", "yollar": "evrak_dahil", "taksit": "kart_secilir", "onay": "sorar", "eksi_stok": "sorar",
           "tarih": "sunucu_gunu", "gec_yeniden": "sunucu_karar", "stok_yonu": "giris_cikis"}
YOK = "__yok__"
ALT = "__alternatifler__"


# ───────────────────────────────────────────────── adım yardımcıları
def ch(kanal, cihaz="DY", kullanici="Y"):
    return {"kanal": "mobil", "cihaz": cihaz} if kanal == "mobil" else {"kanal": "masaustu", "kullanici": kullanici}


def cari(i, ad, isim=None, tur="musteri", acilis=None, tarih="2026-10-01", sirket="001"):
    a = {"id": i, "islem": "cari_ac", "ad": ad, "isim": isim or ad.title(), "tur": tur, "tarih": tarih, "sirket": sirket}
    if acilis:
        a["acilis"] = acilis
    return a


def fat(i, ad, c, tutar, tarih, tur="satis", sirket="001"):
    return {"id": i, "islem": "fatura", "ad": ad, "cari": c, "tutar": tutar, "tarih": tarih, "tur": tur, "sirket": sirket}


def hesap(i, ad, tur, sirket="001"):
    return {"id": i, "islem": "hesap_ac", "ad": ad, "tur": tur, "sirket": sirket}


def kart(i, ad, c, tutar, taksit, ilk="2026-11-01", tarih="2026-10-01", sirket="001"):
    return {"id": i, "islem": "kart_ac", "ad": ad, "cari": c, "tutar": tutar, "taksit": taksit, "ilkVade": ilk, "tarih": tarih, "sirket": sirket}


def tah(i, c, tutar, k, yol="nakit", ik=None, sirket="001", **kw):
    a = {"id": i, "islem": "tahsilat", "sirket": sirket, "cari": c, "tutar": tutar, "yol": yol, "istekKimligi": ik or ("ik-" + i)}
    a.update(k)
    a.update(kw)
    return a


def ode(i, c, tutar, k, yol="nakit", ik=None, sirket="001", **kw):
    a = {"id": i, "islem": "odeme", "sirket": sirket, "cari": c, "tutar": tutar, "yol": yol, "istekKimligi": ik or ("ik-" + i)}
    a.update(k)
    a.update(kw)
    return a


def stk(i, u, yon, miktar, k, ik=None, sirket="001", **kw):
    a = {"id": i, "islem": "stok", "sirket": sirket, "urun": u, "yon": yon, "miktar": miktar, "istekKimligi": ik or ("ik-" + i)}
    a.update(k)
    a.update(kw)
    return a


def yen(i, adim, **kw):
    a = {"id": i, "islem": "yeniden_gonder", "adim": adim}
    a.update(kw)
    return a


def saat(i, s):
    return {"id": i, "islem": "saat", "simdi": s}


def kon(i):
    return {"id": i, "islem": "kontrol"}


def ort(i, islem, **kw):
    a = {"id": i, "islem": islem}
    a.update(kw)
    return a


def bas(simdi="2026-10-20T10:00:00+03:00", sirketler=None, kullanicilar=None, cihazlar=None, **kw):
    b = {"simdi": simdi, "sirketler": sirketler or {"001": {}}, "kullanicilar": kullanicilar or {}, "cihazlar": cihazlar or {"DY": "Y"}}
    b.update(kw)
    return b


# ───────────────────────────────────────────────── beklenen yardımcıları (tutarlar TL; kuruşa çevrilir)
def K(x):
    return int(round(x * 100))


def AD(i, durum, http=None, kod=None, sunucu=None):
    """Adımın dört anahtarı hep birlikte (verilmeyen YOK): üzerine yazmada eski http/kod kalmaz."""
    return {"adim:%s:durum" % i: durum, "adim:%s:http" % i: YOK if http is None else http, "adim:%s:kod" % i: YOK if kod is None else kod,
            "adim:%s:sunucu" % i: YOK if sunucu is None else sunucu}


def SIL(*anahtarlar):
    return {k: YOK for k in anahtarlar}


def KB(k, s="001", cari=None, fatura=None, acilis=None, kartlar=None, kasa=0, kasaGun=None, hesaplar=None, hesapsiz=None, portfoy=0, evrak=0,
       stok=None):
    """Bir kontrolün bir şirketteki BÜTÜN anahtarları (modelin yazdığı her anahtar elle yazılır)."""
    p = "%s:%s:" % (k, s)
    o = {}
    for ad, (bak, say) in (cari or {}).items():
        o[p + "cari:%s:bakiye" % ad] = K(bak)
        o[p + "cari:%s:hareketSayisi" % ad] = say
    for ad, v in (fatura or {}).items():
        o[p + "fatura:%s:acik" % ad] = K(v)
    for ad, v in (acilis or {}).items():
        o[p + "acilis:%s:kalan" % ad] = K(v)
    for ad, (od, fz, kl, sy, tk) in (kartlar or {}).items():
        o[p + "kart:%s:odenen" % ad] = K(od)
        o[p + "kart:%s:fazla" % ad] = K(fz)
        o[p + "kart:%s:kalan" % ad] = K(kl)
        o[p + "kart:%s:tahsilatSayisi" % ad] = sy
        for j, v in enumerate(tk):
            o[p + "kart:%s:taksit%d:odenen" % (ad, j + 1)] = K(v)
    o[p + "kasa"] = K(kasa)
    for t, v in (kasaGun or {}).items():
        o[p + "kasaGun:%s" % t] = K(v)
    for ad, (tur, v) in (hesaplar or {}).items():
        o[p + "%s:%s" % (tur, ad)] = K(v)
    for h, v in (hesapsiz or {}).items():
        o[p + "hesapsiz:%s" % h] = K(v)
    o[p + "portfoy"] = K(portfoy)
    o[p + "evrakSayisi"] = evrak
    for u, (m, sy) in (stok or {}).items():
        o[p + "stok:%s:miktar" % u] = m
        o[p + "stok:%s:hareketSayisi" % u] = sy
    return o


def birles(*ds):
    o = {}
    for d in ds:
        o.update(d)
    return o


ELLE = []


def elle(ad, aciklama, kurallar, baslangic, adimlar, beklenen, pg=None, alternatifler=None, cift=None):
    """cift: ("masaustu", "mobil") için senaryo adlarını üretir; adimlar(kanal) işlevidir."""
    if cift:
        for kanal in ("mobil", "masaustu"):
            ELLE.append({"ad": "%s-%s" % (ad, kanal), "aciklama": aciklama, "kurallar": kurallar,
                         "senaryo": {"dil": kahin.DIL, "ad": "%s-%s" % (ad, kanal), "aciklama": aciklama, "baslangic": baslangic,
                                     "adimlar": adimlar(kanal)},
                         "beklenen": beklenen, "pg": pg or {}, "alternatifler": alternatifler or [],
                         "kanal": kanal, "cift": "%s-%s" % (ad, "masaustu" if kanal == "mobil" else "mobil")})
    else:
        ELLE.append({"ad": ad, "aciklama": aciklama, "kurallar": kurallar,
                     "senaryo": {"dil": kahin.DIL, "ad": ad, "aciklama": aciklama, "baslangic": baslangic, "adimlar": adimlar},
                     "beklenen": beklenen, "pg": pg or {}, "alternatifler": alternatifler or [], "kanal": None, "cift": None})


def elle_beklenen(kayit, p):
    """Birleşim p için elle beklenen {beklenen, alternatifler}. Masaüstü çifti: mobil elle değerinin ESDEGER birleşimi (p'den bağımsız)."""
    if kayit["kanal"] == "masaustu":
        p = ESDEGER
    b = dict(kayit["beklenen"])
    alt = kayit["alternatifler"]
    tekler = [(k, v) for k, v in kayit["pg"].items() if "&" not in k]
    coklar = [(k, v) for k, v in kayit["pg"].items() if "&" in k]
    for k, v in sorted(tekler, key=lambda kv: list(P).index(kv[0].split("=")[0])) + coklar:
        if all(p[x.split("=")[0]] == x.split("=")[1] for x in k.split("&")):
            for kk, vv in v.items():
                if kk == ALT:
                    alt = vv
                else:
                    b[kk] = vv
    return {"beklenen": {k: v for k, v in b.items() if v != YOK}, "alternatifler": alt}


# ═════════════════════════════════════════════════ ELLE SENARYOLAR (beklenenler elle; tutar TL)
D1 = "2026-10-20"

# E01 — eşdeğerlik: nakit tahsilat FIFO + avans + avansın sonraki faturayı kapatması
elle("E01-es-nakit-fifo", "Müşteri A: F1 1.000 (01.10), F2 500 (05.10), F3 700 (10.10). Bağsız nakit 1.200 → en eskiden: F1 0, F2 300, F3 700; bakiye 1.000. "
     "İkinci nakit 1.500 → hepsi kapanır, avans 500 (bakiye −500). Yeni F4 300 → avans kapatır (F4 0, bakiye −200). Mobil = masaüstü.",
     ["KULLANICI mobil yazma mevcut API + para çekirdeği kuralları", "PLAN §8.10 Otomatik (En Eski)", "BAŞ MİMAR S1"],
     bas(), lambda kn: [cari("c1", "A"), fat("f1", "F1", "A", "1000", "2026-10-01"), fat("f2", "F2", "A", "500", "2026-10-05"),
                        fat("f3", "F3", "A", "700", "2026-10-10"), tah("t1", "A", "1200", ch(kn)), kon("k1"), tah("t2", "A", "1500", ch(kn)), kon("k2"),
                        fat("f4", "F4", "A", "300", D1), kon("k3")],
     birles(AD("t1", "ok"), AD("t2", "ok"),
            KB("k1", cari={"A": (1000, 1)}, fatura={"F1": 0, "F2": 300, "F3": 700}, kasa=1200, kasaGun={D1: 1200}),
            KB("k2", cari={"A": (-500, 2)}, fatura={"F1": 0, "F2": 0, "F3": 0}, kasa=2700, kasaGun={D1: 2700}),
            KB("k3", cari={"A": (-200, 2)}, fatura={"F1": 0, "F2": 0, "F3": 0, "F4": 0}, kasa=2700, kasaGun={D1: 2700})),
     cift=True)

# E02 — eşdeğerlik: havale / POS / hesap seçimi
elle("E02-es-havale-pos", "B: F1 2.000. Havale 400 → BNK1; POS 300 hesapsız → tek POS hesabı kendiliğinden (POS1); havale 100 hesapsız → iki banka hesabı → 400 "
     "bank-account-required; havale 250 → POS hesabına → 400 bank-account-invalid; nakit 50 → Kasa. POS ve havale Kasa'ya GİRMEZ (Kasa yalnız nakit).",
     ["PLAN §3.5 hesap seçimi", "KULLANICI kalıcı karar: Kasa yalnız nakit; tahsilatta POS", "PLAN §5.7 ret kodları"],
     bas(), lambda kn: [hesap("h1", "BNK1", "banka"), hesap("h2", "BNK2", "banka"), hesap("h3", "POS1", "pos"), cari("c1", "B"),
                        fat("f1", "F1", "B", "2000", "2026-10-02"), tah("t1", "B", "400", ch(kn), yol="havale", hesap="BNK1"),
                        tah("t2", "B", "300", ch(kn), yol="pos"), tah("t3", "B", "100", ch(kn), yol="havale"),
                        tah("t4", "B", "250", ch(kn), yol="havale", hesap="POS1"), tah("t5", "B", "50", ch(kn)), kon("k1")],
     birles(AD("t1", "ok"), AD("t2", "ok"), AD("t3", "ret", 400, "bank-account-required"), AD("t4", "ret", 400, "bank-account-invalid"), AD("t5", "ok"),
            KB("k1", cari={"B": (1250, 3)}, fatura={"F1": 1250}, kasa=50, kasaGun={D1: 50},
               hesaplar={"BNK1": ("banka", 400), "BNK2": ("banka", 0), "POS1": ("pos", 300)})),
     cift=True)

# E03 — eşdeğerlik: Kapatılacak Fatura; yasak bağlar
elle("E03-es-kapatilacak", "C: F1 1.000, F2 500; 500 Kapatılacak Fatura = F2 → F2 0, F1 1.000; sonra bağsız 300 → F1 700. Başka carinin faturası (F9) ve başka carinin "
     "alış faturası (AF1) → 404; müşteriye ödemede satış faturası (ters yön) → 409; hiçbiri satır yazmaz. Mobil 'yalnız FIFO' kipinde fatura alanlı istek reddedilir "
     "(sessizce FIFO'ya çevrilmez).",
     ["KULLANICI kalıcı karar: Kapatılacak Fatura, fatura kapama yöne göre", "KULLANICI B2.4 başka cari / ters yön", "S1 PARAMETRE"],
     bas(kullanicilar={}), lambda kn: [cari("c1", "C"), cari("c2", "C2"), cari("c3", "T", tur="tedarikci"),
                                       fat("f1", "F1", "C", "1000", "2026-10-01"), fat("f2", "F2", "C", "500", "2026-10-05"),
                                       fat("f9", "F9", "C2", "100", "2026-10-06"), fat("fa", "AF1", "T", "50", "2026-10-07", tur="alis"),
                                       tah("t1", "C", "500", ch(kn), fatura="F2"), kon("k1"), tah("t2", "C", "300", ch(kn)), kon("k2"),
                                       tah("t3", "C", "200", ch(kn), fatura="F9"), tah("t4", "C", "200", ch(kn), fatura="AF1"),
                                       ode("t5", "C", "10", ch(kn), fatura="F1"), kon("k3")],
     birles(AD("t1", "ok"), AD("t2", "ok"), AD("t3", "ret", 404), AD("t4", "ret", 404), AD("t5", "ret", 409),
            KB("k1", cari={"C": (1000, 1), "C2": (100, 0), "T": (-50, 0)}, fatura={"F1": 1000, "F2": 0, "F9": 100, "AF1": 50}, kasa=500, kasaGun={D1: 500}),
            KB("k2", cari={"C": (700, 2), "C2": (100, 0), "T": (-50, 0)}, fatura={"F1": 700, "F2": 0, "F9": 100, "AF1": 50}, kasa=800, kasaGun={D1: 800}),
            KB("k3", cari={"C": (700, 2), "C2": (100, 0), "T": (-50, 0)}, fatura={"F1": 700, "F2": 0, "F9": 100, "AF1": 50}, kasa=800, kasaGun={D1: 800})),
     pg={"kapatilacak=yalniz_fifo": birles(
         AD("t1", "ret", "4xx"), AD("t3", "ret", "4xx"), AD("t4", "ret", "4xx"), AD("t5", "ret", "4xx"),
         KB("k1", cari={"C": (1500, 0), "C2": (100, 0), "T": (-50, 0)}, fatura={"F1": 1000, "F2": 500, "F9": 100, "AF1": 50}, kasa=0),
         SIL("k1:001:kasaGun:%s" % D1),
         KB("k2", cari={"C": (1200, 1), "C2": (100, 0), "T": (-50, 0)}, fatura={"F1": 700, "F2": 500, "F9": 100, "AF1": 50}, kasa=300, kasaGun={D1: 300}),
         KB("k3", cari={"C": (1200, 1), "C2": (100, 0), "T": (-50, 0)}, fatura={"F1": 700, "F2": 500, "F9": 100, "AF1": 50}, kasa=300, kasaGun={D1: 300}))},
     cift=True)

# E04 — eşdeğerlik: tedarikçiye ödeme (nakit, havale, kurumsal kart + Kapatılacak Fatura)
elle("E04-es-odeme", "T: AF1 800, AF2 400. Nakit 600 bağsız, havale 300 (BNK1) bağsız, Kredi Kartı 100 (KK1) Kapatılacak Fatura = AF2 → AF2: bağlı 100 → 300; havuz 900 "
     "→ AF1 0, AF2 200. Kasa 2.000 − 600; banka −300; kurumsal kart −100 (309 alacak bakiyesi).",
     ["KULLANICI kalıcı karar: ödemede Kredi Kartı", "PLAN §3.5", "BAŞ MİMAR S1 borç tarafı"],
     bas(), lambda kn: [{"id": "ka", "islem": "kasa_acilis", "tutar": "2000", "tarih": "2026-10-01"}, hesap("h1", "BNK1", "banka"),
                        hesap("h2", "KK1", "kart"), cari("c1", "T", tur="tedarikci"), fat("f1", "AF1", "T", "800", "2026-10-02", tur="alis"),
                        fat("f2", "AF2", "T", "400", "2026-10-06", tur="alis"), ode("o1", "T", "600", ch(kn)),
                        ode("o2", "T", "300", ch(kn), yol="havale", hesap="BNK1"), ode("o3", "T", "100", ch(kn), yol="kart", hesap="KK1", fatura="AF2"),
                        kon("k1")],
     birles(AD("o1", "ok"), AD("o2", "ok"), AD("o3", "ok"),
            KB("k1", cari={"T": (-200, 3)}, fatura={"AF1": 0, "AF2": 200}, kasa=1400, kasaGun={"2026-10-01": 2000, D1: -600},
               hesaplar={"BNK1": ("banka", -300), "KK1": ("kartHesap", -100)})),
     pg={"kapatilacak=yalniz_fifo": birles(AD("o3", "ret", "4xx"),
                                           KB("k1", cari={"T": (-300, 2)}, fatura={"AF1": 0, "AF2": 300}, kasa=1400, kasaGun={"2026-10-01": 2000, D1: -600},
                                              hesaplar={"BNK1": ("banka", -300), "KK1": ("kartHesap", 0)}))},
     cift=True)

# E05 — eşdeğerlik: taksit kartı K8
_E05_YC = birles(AD("t1", "ret", "4xx"), AD("t2", "ret", "4xx"), AD("t3", "ret", "4xx"), AD("t4", "ret", "4xx"),
                 KB("k1", cari={"K": (1200, 0)}, kartlar={"KT1": (0, 0, 1200, 0, [0, 0, 0])}, kasa=0), SIL("k1:001:kasaGun:%s" % D1),
                 KB("k2", cari={"K": (1200, 0)}, kartlar={"KT1": (0, 0, 1200, 0, [0, 0, 0])}, kasa=0), SIL("k2:001:kasaGun:%s" % D1))
elle("E05-es-taksit", "K: açılış 1.200, Mevcut Borcu Taksitlendir kartı 1.200 / 3. Kart tahsilatı 500 → taksit 400 / 100 / 0, kalan 700. 800 → 409 plan-overpay; 800 "
     "Fazlasını Avans Yaz (yönetici) → ödenen 1.200 + fazla 100, cari −100; 100 → 409 plan-paid.",
     ["PLAN §3.10/3 K8", "S3 PARAMETRE", "S4 PARAMETRE (Fazlasını Avans Yaz)"],
     bas(), lambda kn: [cari("c1", "K", acilis="1200"), kart("ka", "KT1", "K", "1200", 3), tah("t1", "K", "500", ch(kn), kart="KT1"), kon("k1"),
                        tah("t2", "K", "800", ch(kn), kart="KT1"), tah("t3", "K", "800", ch(kn), kart="KT1", fazlaAvans=True),
                        tah("t4", "K", "100", ch(kn), kart="KT1"), kon("k2")],
     birles(AD("t1", "ok"), AD("t2", "ret", 409, "plan-overpay"), AD("t3", "ok"), AD("t4", "ret", 409, "plan-paid"),
            KB("k1", cari={"K": (700, 0)}, kartlar={"KT1": (500, 0, 700, 1, [400, 100, 0])}, kasa=500, kasaGun={D1: 500}),
            KB("k2", cari={"K": (-100, 0)}, kartlar={"KT1": (1200, 100, 0, 2, [400, 400, 400])}, kasa=1300, kasaGun={D1: 1300})),
     pg={"taksit=yalniz_cari": _E05_YC,
         "onay=gecemez": birles(AD("t3", "ret", 409, "plan-overpay"), AD("t4", "ok"),
                                KB("k2", cari={"K": (600, 0)}, kartlar={"KT1": (600, 0, 600, 2, [400, 200, 0])}, kasa=600, kasaGun={D1: 600})),
         "taksit=yalniz_cari&onay=gecemez": _E05_YC},
     cift=True)

# E06 — kesinti ÖNCE: istek sunucuya ulaşmadı; aynı kimlikle yeniden gönderim bir kez yazar
elle("E06-kesinti-once", "Tünel istek sunucuya ulaşmadan koptu: kayıt yok, telefon 'sonucu belirsiz'. Aynı kimlikle yeniden gönderim yazar (1 kayıt); bir daha → 'zaten "
     "kaydedildi', ikinci kayıt yok.", ["PLAN §3.10/1 kalıcı istek kimliği", "iş listesi Nasıl bozulur: tünel kopar"],
     bas(), [cari("c1", "A"), fat("f1", "F1", "A", "1000", "2026-10-01"), tah("t1", "A", "300", ch("mobil"), kesinti="once"), kon("k1"),
             saat("s1", "2026-10-20T10:10:00+03:00"), yen("y1", "t1"), kon("k2"), yen("y2", "t1"), kon("k3")],
     birles(AD("t1", "belirsiz", sunucu="yok"), AD("y1", "ok"), AD("y2", "yineleme"),
            KB("k1", cari={"A": (1000, 0)}, fatura={"F1": 1000}, kasa=0),
            KB("k2", cari={"A": (700, 1)}, fatura={"F1": 700}, kasa=300, kasaGun={D1: 300}),
            KB("k3", cari={"A": (700, 1)}, fatura={"F1": 700}, kasa=300, kasaGun={D1: 300})))

# E07 — kesinti SONRA: sunucu yazdı, yanıt kayboldu
elle("E07-kesinti-sonra", "Sunucu yazdı, yanıt kayboldu: kayıt 1. Aynı kimlikle yeniden gönderim 'zaten kaydedildi' (kayıt 1). Kullanıcı YENİ formla aynı tutarı yeniden "
     "girerse (yeni kimlik) ikinci kayıt açılır — nakitte Benzer İşlem yok (PLAN).",
     ["PLAN §3.10/1 replayed", "PLAN §3.10/2 nakit denetlenmez"],
     bas(), [cari("c1", "A"), fat("f1", "F1", "A", "1000", "2026-10-01"), tah("t1", "A", "300", ch("mobil"), kesinti="sonra"), kon("k1"),
             saat("s1", "2026-10-20T10:05:00+03:00"), yen("y1", "t1"), tah("t2", "A", "300", ch("mobil")), kon("k2")],
     birles(AD("t1", "belirsiz", sunucu="ok"), AD("y1", "yineleme"), AD("t2", "ok"),
            KB("k1", cari={"A": (700, 1)}, fatura={"F1": 700}, kasa=300, kasaGun={D1: 300}),
            KB("k2", cari={"A": (400, 2)}, fatura={"F1": 400}, kasa=600, kasaGun={D1: 600})))

# E08 — aynı kimlik, farklı gövde
elle("E08-ayni-kimlik-farkli-govde", "Kimlik x1 ile 300 yazıldı; aynı kimlikle 350 → 409 (yazmaz); aynı kimlikle 300 → 'zaten kaydedildi'.",
     ["PLAN §3.10/1 aynı kimlik + farklı içerik → 409"],
     bas(), [cari("c1", "A"), tah("t1", "A", "300", ch("mobil"), ik="x1"), tah("t2", "A", "350", ch("mobil"), ik="x1"),
             tah("t3", "A", "300", ch("mobil"), ik="x1"), kon("k1")],
     birles(AD("t1", "ok"), AD("t2", "ret", 409), AD("t3", "yineleme"), KB("k1", cari={"A": (-300, 1)}, kasa=300, kasaGun={D1: 300})))

# E09 — reddedilen istek kimliği hatırlanmaz; tutar biçimi
elle("E09-reddedilen-kimlik", "Tutar 0 → 400; aynı kimlikle 250 → yazılır (reddedilen kimlik hatırlanmaz). 3 ondalık, eksi, binlik ayırıcı → 400.",
     ["SENARYO-DILI §5.4 (ÇIKARIM §3.3 adım 10)", "PLAN §9.2/9 tutar"],
     bas(), [cari("c1", "A"), tah("t1", "A", "0", ch("mobil"), ik="r1"), tah("t2", "A", "250", ch("mobil"), ik="r1"),
             tah("t3", "A", "12,345", ch("mobil")), tah("t4", "A", "-5", ch("mobil")), tah("t5", "A", "1.234,56", ch("mobil")), kon("k1")],
     birles(AD("t1", "ret", 400), AD("t2", "ok"), AD("t3", "ret", 400), AD("t4", "ret", 400), AD("t5", "ret", 400),
            KB("k1", cari={"A": (-250, 1)}, kasa=250, kasaGun={D1: 250})))

# E10 — sunucu kapalı: yazma yok, kuyruk yok
elle("E10-sunucu-kapali", "Sunucu kapalıyken mobil tahsilat girilemez (ulaşılamadı); sunucu açılınca kendiliğinden YAZILMAZ (kuyruk yok). Sonra yeni form yazar.",
     ["KULLANICI 26.10 'sunucu kapalıysa … sadece tahsilat giremeyecekti'"],
     bas(), [cari("c1", "A"), ort("s1", "sunucu", durum="kapali"), tah("t1", "A", "400", ch("mobil")), ort("s2", "sunucu", durum="acik"), kon("k1"),
             tah("t2", "A", "400", ch("mobil")), kon("k2")],
     birles(AD("t1", "ulasilamadi"), AD("t2", "ok"), KB("k1", cari={"A": (0, 0)}, kasa=0),
            KB("k2", cari={"A": (-400, 1)}, kasa=400, kasaGun={D1: 400})))

# E11 — yeniden başlatma sonrası istek kimliği
elle("E11-sunucu-yeniden-kimlik", "Yazıldı, yanıt kayboldu; program yeniden başladı; aynı kimlik → 'zaten kaydedildi'.",
     ["PLAN Aşama 2 'Yeniden başlatmadan sonra istek kimliği hatırlanır'"],
     bas(), [cari("c1", "A"), tah("t1", "A", "100", ch("mobil"), kesinti="sonra"), ort("s1", "sunucu", durum="yeniden"), yen("y1", "t1"), kon("k1")],
     birles(AD("t1", "belirsiz", sunucu="ok"), AD("y1", "yineleme"), KB("k1", cari={"A": (-100, 1)}, kasa=100, kasaGun={D1: 100})))

# E12 — silinen cihaz
elle("E12-cihaz-silindi", "DY silinince yazamaz; aynı kullanıcının öbür cihazı (DY2) ve yeni eşlenen DY3 yazar.",
     ["KULLANICI cihaz sınırı 'cihaz silinince yer açılır'", "iş listesi M2 'cihaz silme → erişim kesilir'"],
     bas(cihazlar={"DY": "Y", "DY2": "Y"}),
     [cari("c1", "A"), tah("t1", "A", "100", ch("mobil")), ort("d1", "cihaz_sil", cihaz="DY"), tah("t2", "A", "100", ch("mobil")),
      tah("t3", "A", "100", ch("mobil", "DY2")), ort("d2", "cihaz_esle", cihaz="DY3", kullanici="Y"), tah("t4", "A", "100", ch("mobil", "DY3")), kon("k1")],
     birles(AD("t1", "ok"), AD("t2", "ret", "4xx"), AD("t3", "ok"), AD("t4", "ok"), KB("k1", cari={"A": (-300, 3)}, kasa=300, kasaGun={D1: 300})))

# E13 — Uzaktan Bağlanabilir izni
elle("E13-uzak-izin", "Personel P'nin izni kaldırılınca cihazı yazamaz, masaüstü sürer; izin geri verilince eski cihaz yine yazamaz (yeniden eşleme gerekir); yeni eşleme yazar.",
     ["PRO-UZAKTAN 'Uzaktan bağlanabilir kutusu'; 'Yeniden eşleme gereken durumlar: … izni kaldırır'", "PLAN §2.5 personel tahsilatı"],
     bas(kullanicilar={"P": {"rol": "personel", "uzak": True}}, cihazlar={"DY": "Y", "DP": "P"}),
     [cari("c1", "A"), tah("t1", "A", "100", ch("mobil", "DP")), ort("u1", "uzak_izin", kullanici="P", deger=False), tah("t2", "A", "100", ch("mobil", "DP")),
      tah("t3", "A", "100", ch("masaustu", kullanici="P")), ort("u2", "uzak_izin", kullanici="P", deger=True), tah("t4", "A", "100", ch("mobil", "DP")),
      ort("u3", "cihaz_esle", cihaz="DP2", kullanici="P"), tah("t5", "A", "100", ch("mobil", "DP2")), kon("k1")],
     birles(AD("t1", "ok"), AD("t2", "ret", "4xx"), AD("t3", "ok"), AD("t4", "ret", "4xx"), AD("t5", "ok"),
            KB("k1", cari={"A": (-300, 3)}, kasa=300, kasaGun={D1: 300})))

# E14 — lisans
elle("E14-lisans", "Lisans bitince mobil yazamaz; yenilenince eşleme geri gelir.", ["PRO-UZAKTAN 'Lisans süresi biter … Worker o ofisin dosyasını vermez'; 'yenilenince eşlemeler geri gelecek'"],
     bas(), [cari("c1", "A"), tah("t1", "A", "100", ch("mobil")), ort("l1", "lisans", durum="bitti"), tah("t2", "A", "100", ch("mobil")),
             ort("l2", "lisans", durum="gecerli"), tah("t3", "A", "100", ch("mobil")), kon("k1")],
     birles(AD("t1", "ok"), AD("t2", "ret", "4xx"), AD("t3", "ok"), KB("k1", cari={"A": (-200, 2)}, kasa=200, kasaGun={D1: 200})))

# E15 — şirket yetkisi (kullanıcı × şirket)
elle("E15-sirket-yetkisi", "P (işaretsiz → yalnız 001), M (yalnız 002), Y (hepsi). Yetkisiz şirkete mobil yazma reddedilir; yetki değişince hemen uygulanır (eşleme anındaki yetki sürmez).",
     ["MEVCUT ÜRÜN (ana oturum koddan doğruladı): kullanıcı × şirket; yönetici hepsi; işaretsiz yalnız 001"],
     bas(sirketler={"001": {}, "002": {}}, kullanicilar={"P": {"rol": "personel", "uzak": True, "sirketler": []},
                                                        "M": {"rol": "muhasebe", "uzak": True, "sirketler": ["002"]}},
         cihazlar={"DY": "Y", "DP": "P", "DM": "M"}),
     [cari("c1", "A1"), cari("c2", "B1", sirket="002"), tah("t1", "A1", "100", ch("mobil", "DP")), tah("t2", "B1", "100", ch("mobil", "DP"), sirket="002"),
      tah("t3", "B1", "100", ch("mobil", "DM"), sirket="002"), tah("t4", "A1", "100", ch("mobil", "DM")), tah("t5", "B1", "100", ch("mobil", "DY"), sirket="002"),
      ort("y1", "sirket_yetki", kullanici="P", sirketler=["001", "002"]), tah("t6", "B1", "100", ch("mobil", "DP"), sirket="002"),
      ort("y2", "sirket_yetki", kullanici="M", sirketler=[]), tah("t7", "A1", "100", ch("mobil", "DM")), tah("t8", "B1", "100", ch("mobil", "DM"), sirket="002"),
      kon("k1")],
     birles(AD("t1", "ok"), AD("t2", "ret", "4xx"), AD("t3", "ok"), AD("t4", "ret", "4xx"), AD("t5", "ok"), AD("t6", "ok"), AD("t7", "ok"), AD("t8", "ret", "4xx"),
            KB("k1", "001", cari={"A1": (-200, 2)}, kasa=200, kasaGun={D1: 200}), KB("k1", "002", cari={"B1": (-300, 3)}, kasa=300, kasaGun={D1: 300})))

# E16 — başka şirketin cari / hesap kimliği
elle("E16-baska-sirket-kimligi", "001 isteğinde 002'nin carisi (ya da tersi) ve 002'nin banka hesabı: hiçbir şirkete yazılmaz (403/404). Masaüstünde de aynı.",
     ["KULLANICI 'Şirket = ayrı veri dosyası'", "YAYGIN: kimlik isteğin şirketinde çözülür"],
     bas(sirketler={"001": {}, "002": {}}),
     [cari("c1", "A1"), cari("c2", "B1", sirket="002"), hesap("h1", "BNK1", "banka"), hesap("h2", "BNK2", "banka", sirket="002"),
      tah("t1", "B1", "100", ch("mobil")), tah("t2", "A1", "100", ch("mobil"), sirket="002"), tah("t3", "A1", "100", ch("mobil"), yol="havale", hesap="BNK2"),
      tah("t4", "B1", "100", ch("masaustu")), tah("t5", "A1", "100", ch("mobil"), yol="havale"), kon("k1")],
     birles(AD("t1", "ret", [403, 404]), AD("t2", "ret", [403, 404]), AD("t3", "ret", [400, 404]), AD("t4", "ret", [403, 404]), AD("t5", "ok"),
            KB("k1", "001", cari={"A1": (-100, 1)}, kasa=0, hesaplar={"BNK1": ("banka", 100)}),
            KB("k1", "002", cari={"B1": (0, 0)}, kasa=0, hesaplar={"BNK2": ("banka", 0)})))

# E17 — iki cihaz / masaüstü + mobil aynı anda aynı cari
_E17_ALT = [
    {"adim:t3:durum": "ok", "adim:t3:http": YOK, "adim:t3:kod": YOK, "adim:t4:durum": "ret", "adim:t4:http": 409, "adim:t4:kod": "bank-similar"},
    {"adim:t3:durum": "ret", "adim:t3:http": 409, "adim:t3:kod": "bank-similar", "adim:t4:durum": "ok", "adim:t4:http": YOK, "adim:t4:kod": YOK},
]
elle("E17-ayni-anda-ayni-cari", "Mobil 400 + masaüstü 600 aynı anda (A: F1 1.000, F2 500) → sıra ne olursa olsun F1 0, F2 500. İki cihazdan aynı gün aynı hesaba aynı "
     "tutarda havale aynı anda → biri Benzer İşlem (409), hangisi olduğu sıraya bağlı; para aynı.",
     ["PLAN §9.2/12 BEGIN IMMEDIATE (sıralanabilir)", "PLAN §3.10/2", "SENARYO-DILI §5.8"],
     bas(cihazlar={"DY": "Y", "DY2": "Y"}),
     [hesap("h1", "BNK1", "banka"), cari("c1", "A"), fat("f1", "F1", "A", "1000", "2026-10-01"), fat("f2", "F2", "A", "500", "2026-10-05"),
      tah("t1", "A", "400", ch("mobil"), ayniAnda="g1"), tah("t2", "A", "600", ch("masaustu"), ayniAnda="g1"),
      tah("t3", "A", "200", ch("mobil"), yol="havale", hesap="BNK1", ayniAnda="g2"), tah("t4", "A", "200", ch("mobil", "DY2"), yol="havale", hesap="BNK1", ayniAnda="g2"),
      kon("k1")],
     birles(AD("t1", "ok"), AD("t2", "ok"),
            KB("k1", cari={"A": (300, 3)}, fatura={"F1": 0, "F2": 300}, kasa=1000, kasaGun={D1: 1000}, hesaplar={"BNK1": ("banka", 200)})),
     alternatifler=_E17_ALT)

# E18 — K8 yarışı: iki cihaz aynı karta
_E18_ALT = [
    {"adim:t1:durum": "ok", "adim:t1:http": YOK, "adim:t1:kod": YOK, "adim:t2:durum": "ret", "adim:t2:http": 409, "adim:t2:kod": "plan-overpay"},
    {"adim:t1:durum": "ret", "adim:t1:http": 409, "adim:t1:kod": "plan-overpay", "adim:t2:durum": "ok", "adim:t2:http": YOK, "adim:t2:kod": YOK},
]
elle("E18-k8-yaris", "Kalan 500 olan karta iki cihazdan aynı anda 300 + 300: biri plan-overpay (hangisi olduğu sıraya bağlı); ödenen 300, kalan 200.",
     ["PLAN §3.10/3 'Kartın kalanı BEGIN IMMEDIATE içinde yeniden okunur'"],
     bas(cihazlar={"DY": "Y", "DY2": "Y"}),
     [cari("c1", "K", acilis="500"), kart("ka", "KT", "K", "500", 1), tah("t1", "K", "300", ch("mobil"), kart="KT", ayniAnda="g1"),
      tah("t2", "K", "300", ch("mobil", "DY2"), kart="KT", ayniAnda="g1"), kon("k1")],
     KB("k1", cari={"K": (200, 0)}, kartlar={"KT": (300, 0, 200, 1, [300])}, kasa=300, kasaGun={D1: 300}),
     pg={"taksit=yalniz_cari": birles(AD("t1", "ret", "4xx"), AD("t2", "ret", "4xx"), KB("k1", cari={"K": (500, 0)}, kartlar={"KT": (0, 0, 500, 0, [0])}, kasa=0),
                                      SIL("k1:001:kasaGun:%s" % D1), {ALT: []})},
     alternatifler=_E18_ALT)

# E19 — eşdeğerlik: stok ve eksi stok sorusu
elle("E19-es-stok", "U1: masaüstü girişi 5. Çıkış 3 → 2; çıkış 4 → eksi stok sorusu (yazılmaz); çıkış 4 'izin ver' → −2; giriş 10 → 8.",
     ["KULLANICI kalıcı karar 02.10.2026 'Eksi stok: program sorar, izin ver denince eksiye düşer'", "S5, S8 PARAMETRE"],
     bas(), lambda kn: [{"id": "u1", "islem": "urun_ac", "ad": "U1"}, stk("s0", "U1", "giris", 5, ch("masaustu")), stk("s1", "U1", "cikis", 3, ch(kn)),
                        stk("s2", "U1", "cikis", 4, ch(kn)), stk("s3", "U1", "cikis", 4, ch(kn), eksiOnay=True), stk("s4", "U1", "giris", 10, ch(kn)), kon("k1")],
     birles(AD("s0", "ok"), AD("s1", "ok"), AD("s2", "ret", "4xx"), AD("s3", "ok"), AD("s4", "ok"), KB("k1", stok={"U1": (8, 4)})),
     pg={"eksi_stok=gecemez": birles(AD("s3", "ret", "4xx"), KB("k1", stok={"U1": (12, 3)})),
         "stok_yonu=yalniz_giris": birles(AD("s1", "ret", "4xx"), AD("s2", "ret", "4xx"), AD("s3", "ret", "4xx"), KB("k1", stok={"U1": (15, 2)}))},
     cift=True)

# E20 — stok yarışı (mobil + masaüstü aynı anda)
elle("E20-stok-yaris", "Stok 5; mobil çıkış 3 ve masaüstü çıkış 3 aynı anda: biri eksi stok sorusuna düşer; stok 2.",
     ["PLAN §9.2/12 (sıralanabilir)", "KULLANICI eksi stok sorusu"],
     bas(), [{"id": "u1", "islem": "urun_ac", "ad": "U1"}, stk("s0", "U1", "giris", 5, ch("masaustu")), stk("s1", "U1", "cikis", 3, ch("mobil"), ayniAnda="g"),
             stk("s2", "U1", "cikis", 3, ch("masaustu"), ayniAnda="g"), kon("k1")],
     birles(AD("s0", "ok"), KB("k1", stok={"U1": (2, 2)})),
     pg={"stok_yonu=yalniz_giris": birles(AD("s1", "ret", "4xx"), AD("s2", "ok"), {ALT: []})},
     alternatifler=[{"adim:s1:durum": "ok", "adim:s1:http": YOK, "adim:s2:durum": "ret", "adim:s2:http": "4xx"},
                    {"adim:s1:durum": "ret", "adim:s1:http": "4xx", "adim:s2:durum": "ok", "adim:s2:http": YOK}])

# E21 — gece yarısı, UTC tuzağı, form tarihi
elle("E21-gece-yarisi", "31.10 23:59:59 → 31.10; 01.11 00:00:00 → 01.11; 01.11 02:30 TR (UTC'de hâlâ 31.10) → 01.11. Formda dün (31.10) seçili: sunucu günü kipinde yok sayılır "
     "(01.11), form tarihi kipinde 31.10. İleri tarih masaüstünde 400; mobilde sunucu günü kipinde gönderilmez (bugün yazılır), form kipinde 400.",
     ["PLAN §2.5 ileri tarih", "V1 TR saati", "S6 PARAMETRE", "ders 13/22"],
     bas(simdi="2026-10-31T23:59:59+03:00"),
     [cari("c1", "A"), tah("t1", "A", "100", ch("mobil")), saat("s1", "2026-11-01T00:00:00+03:00"), tah("t2", "A", "200", ch("mobil")),
      saat("s2", "2026-11-01T02:30:00+03:00"), tah("t3", "A", "50", ch("mobil")), tah("t4", "A", "70", ch("mobil"), tarih="2026-10-31"),
      tah("t5", "A", "30", ch("masaustu"), tarih="2026-11-02"), tah("t6", "A", "40", ch("mobil"), tarih="2026-11-02"), kon("k1")],
     birles(AD("t1", "ok"), AD("t2", "ok"), AD("t3", "ok"), AD("t4", "ok"), AD("t5", "ret", 400), AD("t6", "ok"),
            KB("k1", cari={"A": (-460, 5)}, kasa=460, kasaGun={"2026-10-31": 100, "2026-11-01": 360})),
     pg={"tarih=form_tarihi": birles(AD("t6", "ret", 400), KB("k1", cari={"A": (-420, 4)}, kasa=420, kasaGun={"2026-10-31": 170, "2026-11-01": 250}))})

# E22 — gece yarısını geçen yeniden gönderim
elle("E22-gece-yarisi-yeniden", "31.10 23:59:58: biri sunucuya ulaşmadı, biri yazıldı (yanıt kayboldu). 01.11 00:00:03 yeniden gönderim: ulaşmayan 01.11'e yazılır (sunucu günü) ya da "
     "formun günü 31.10'a (form tarihi); yazılmış olan 'zaten kaydedildi', günü 31.10 kalır.",
     ["S6 PARAMETRE", "PLAN §3.10/1", "ders 22"],
     bas(simdi="2026-10-31T23:59:58+03:00"),
     [cari("c1", "A"), tah("t1", "A", "100", ch("mobil"), kesinti="once"), tah("t2", "A", "200", ch("mobil"), kesinti="sonra"),
      saat("s1", "2026-11-01T00:00:03+03:00"), yen("y1", "t1"), yen("y2", "t2"), kon("k1")],
     birles(AD("t1", "belirsiz", sunucu="yok"), AD("t2", "belirsiz", sunucu="ok"), AD("y1", "ok"), AD("y2", "yineleme"),
            KB("k1", cari={"A": (-300, 2)}, kasa=300, kasaGun={"2026-10-31": 200, "2026-11-01": 100})),
     pg={"tarih=form_tarihi": birles(KB("k1", cari={"A": (-300, 2)}, kasa=300, kasaGun={"2026-10-31": 300}), SIL("k1:001:kasaGun:2026-11-01"))})

# E23 — yıl dönümü + dönem kilidi
elle("E23-yil-donumu-kilit", "31.12.2026 23:59:30 tahsilat 31.12; 01.01.2027'de 31.12'ye kadar dönem kilitlendi. Form 31.12 23:59:50'de açılmış, 00:00:10'da gönderildi: sunucu günü "
     "kipinde 01.01'e yazılır; form tarihi kipinde 31.12 → 409 period-locked. Masaüstünde 31.12 tarihli → 409; tarihsiz → 01.01.",
     ["PLAN §4.3 / SENARYO-DILI §5.1 dönem kilidi", "S6 PARAMETRE", "ders 13 yıl dönümü"],
     bas(simdi="2026-12-31T23:59:30+03:00"),
     [cari("c1", "A"), tah("t1", "A", "100", ch("mobil")), saat("s1", "2027-01-01T00:00:10+03:00"), {"id": "dk", "islem": "donem_kilitle", "tarih": "2026-12-31"},
      tah("t2", "A", "100", ch("mobil"), formAcilis="2026-12-31T23:59:50+03:00"), tah("t3", "A", "100", ch("masaustu"), tarih="2026-12-31"),
      tah("t4", "A", "100", ch("masaustu")), kon("k1")],
     birles(AD("t1", "ok"), AD("t2", "ok"), AD("t3", "ret", 409, "period-locked"), AD("t4", "ok"),
            KB("k1", cari={"A": (-300, 3)}, kasa=300, kasaGun={"2026-12-31": 100, "2027-01-01": 200})),
     pg={"tarih=form_tarihi": birles(AD("t2", "ret", 409, "period-locked"), KB("k1", cari={"A": (-200, 2)}, kasa=200, kasaGun={"2026-12-31": 100, "2027-01-01": 100}))})

# E24 — istek kimliği ömrü (30 gün) ve geç yeniden gönderim (S7)
_E24_ALT_SK = [
    {"adim:y2:durum": "yineleme", "k2:001:cari:A:bakiye": K(-170), "k2:001:cari:A:hareketSayisi": 2, "k2:001:kasa": K(170), "k2:001:kasaGun:2026-12-14": YOK,
     "k3:001:cari:A:bakiye": K(-200), "k3:001:cari:A:hareketSayisi": 3, "k3:001:kasa": K(200), "k3:001:kasaGun:2026-12-14": K(30)},
    {"adim:y2:durum": "ok", "k2:001:cari:A:bakiye": K(-240), "k2:001:cari:A:hareketSayisi": 3, "k2:001:kasa": K(240), "k2:001:kasaGun:2026-12-14": K(70),
     "k3:001:cari:A:bakiye": K(-270), "k3:001:cari:A:hareketSayisi": 4, "k3:001:kasa": K(270), "k3:001:kasaGun:2026-12-14": K(100)},
]
# form tarihi kipinde budanmış dünyadaki ikinci kayıt formun günü 30.10'a yazılır; t3'ün formu 14.12 (iki dünyada da 30)
_E24_ALT_FORM = [
    {"adim:y2:durum": "yineleme", "k2:001:cari:A:bakiye": K(-170), "k2:001:cari:A:hareketSayisi": 2, "k2:001:kasa": K(170), "k2:001:kasaGun:2026-10-30": K(70),
     "k3:001:cari:A:bakiye": K(-200), "k3:001:cari:A:hareketSayisi": 3, "k3:001:kasa": K(200), "k3:001:kasaGun:2026-10-30": K(70)},
    {"adim:y2:durum": "ok", "k2:001:cari:A:bakiye": K(-240), "k2:001:cari:A:hareketSayisi": 3, "k2:001:kasa": K(240), "k2:001:kasaGun:2026-10-30": K(140),
     "k3:001:cari:A:bakiye": K(-270), "k3:001:cari:A:hareketSayisi": 4, "k3:001:kasa": K(270), "k3:001:kasaGun:2026-10-30": K(140)},
]
_E24_TABAN = birles(
    AD("t1", "belirsiz", sunucu="ok"), AD("y1", "yineleme"), AD("t2", "belirsiz", sunucu="ok"), AD("t3", "belirsiz", sunucu="yok"), AD("y3", "ok"), AD("y4", "yineleme"),
    KB("k1", cari={"A": (-100, 1)}, kasa=100, kasaGun={"2026-10-01": 100}),
    {"k2:001:kasaGun:2026-10-01": K(100), "k2:001:kasaGun:2026-10-30": K(70), "k2:001:portfoy": 0, "k2:001:evrakSayisi": 0},
    {"k3:001:kasaGun:2026-10-01": K(100), "k3:001:kasaGun:2026-10-30": K(70), "k3:001:portfoy": 0, "k3:001:evrakSayisi": 0})
elle("E24-kimlik-omru", "Yazılmış (yanıtı kaybolmuş) istek 29 gün sonra yeniden gönderilir → 'zaten kaydedildi' (30 gün hatırlanır). 45 gün sonra → plan '30 günden eskiler "
     "budanır' der ama ne zaman budandığını söylemez → iki dünya (zaten kaydedildi / ikinci kayıt). 'Telefon 24 saat' kipinde 24 saatten eski belirsiz istek hiç "
     "gönderilmez (atıldı; kullanıcı Cari'den bakar).",
     ["PLAN §3.10/1 '30 günden eskiler budanır'", "S7 PARAMETRE"],
     bas(simdi="2026-10-01T10:00:00+03:00"),
     [cari("c1", "A"), tah("t1", "A", "100", ch("mobil"), kesinti="sonra"), saat("s1", "2026-10-30T10:00:00+03:00"), yen("y1", "t1"), kon("k1"),
      tah("t2", "A", "70", ch("mobil"), kesinti="sonra"), saat("s2", "2026-12-14T10:00:00+03:00"), yen("y2", "t2"), kon("k2"),
      tah("t3", "A", "30", ch("mobil"), kesinti="once"), saat("s3", "2026-12-14T20:00:00+03:00"), yen("y3", "t3"), saat("s4", "2026-12-16T10:00:00+03:00"),
      yen("y4", "t3"), kon("k3")],
     _E24_TABAN,
     pg={"tarih=form_tarihi": birles(SIL("k2:001:kasaGun:2026-10-30", "k3:001:kasaGun:2026-10-30"), {"k3:001:kasaGun:2026-12-14": K(30)}, {ALT: _E24_ALT_FORM}),
         "gec_yeniden=telefon_24s": birles(AD("y1", "atildi"), AD("y2", "atildi"), AD("y4", "atildi"),
                                          KB("k2", cari={"A": (-170, 2)}, kasa=170, kasaGun={"2026-10-01": 100, "2026-10-30": 70}),
                                          KB("k3", cari={"A": (-200, 3)}, kasa=200, kasaGun={"2026-10-01": 100, "2026-10-30": 70, "2026-12-14": 30}),
                                          {ALT: []})},
     alternatifler=_E24_ALT_SK)

# E25 — yedekten geri yükleme ve istek kimliği
elle("E25-yedek-geri-yukle", "Yedek → mobil tahsilat yazıldı (yanıt kayboldu) → yedekten geri yükleme kaydı götürür → aynı kimlikle yeniden gönderim YENİDEN YAZAR (kimlik de "
     "aynı anlık görüntüyle geri döndü). 'Zaten kaydedildi' denip kayıt olmaması para kaybıdır.",
     ["YAYGIN V12: istek kimlikleri şirket verisiyle aynı anlık görüntüde (PLAN request_keys şirket tablolarında)"],
     bas(), [cari("c1", "A"), {"id": "yd", "islem": "yedek_al", "ad": "Y1"}, tah("t1", "A", "300", ch("mobil"), kesinti="sonra"), kon("k1"),
             {"id": "gy", "islem": "yedek_geri_yukle", "yedek": "Y1"}, kon("k2"), yen("y1", "t1"), kon("k3")],
     birles(AD("t1", "belirsiz", sunucu="ok"), AD("y1", "ok"), KB("k1", cari={"A": (-300, 1)}, kasa=300, kasaGun={D1: 300}),
            KB("k2", cari={"A": (0, 0)}, kasa=0), KB("k3", cari={"A": (-300, 1)}, kasa=300, kasaGun={D1: 300})))

# E26 — aynı adlı üç cari, iki şirket
elle("E26-ayni-adli-cariler", "001'de iki 'Ahmet Yılmaz' (A1, A2), 002'de bir (A3). Mobil tahsilat kimliğe göre doğru cariye; adı aynı olanlar etkilenmez.",
     ["test kuralı 'aynı adlı iki kişi'"],
     bas(sirketler={"001": {}, "002": {}}),
     [cari("c1", "A1", "Ahmet Yılmaz"), cari("c2", "A2", "Ahmet Yılmaz"), cari("c3", "A3", "Ahmet Yılmaz", sirket="002"),
      fat("f1", "F1", "A1", "500", "2026-10-01"), fat("f2", "F2", "A2", "700", "2026-10-02"), fat("f3", "F3", "A3", "900", "2026-10-03", sirket="002"),
      tah("t1", "A2", "200", ch("mobil")), kon("k1"), tah("t2", "A3", "900", ch("mobil"), sirket="002"), kon("k2")],
     birles(AD("t1", "ok"), AD("t2", "ok"),
            KB("k1", "001", cari={"A1": (500, 0), "A2": (500, 1)}, fatura={"F1": 500, "F2": 500}, kasa=200, kasaGun={D1: 200}),
            KB("k1", "002", cari={"A3": (900, 0)}, fatura={"F3": 900}, kasa=0),
            KB("k2", "001", cari={"A1": (500, 0), "A2": (500, 1)}, fatura={"F1": 500, "F2": 500}, kasa=200, kasaGun={D1: 200}),
            KB("k2", "002", cari={"A3": (0, 1)}, fatura={"F3": 0}, kasa=900, kasaGun={D1: 900})))

# E27 — eski sürüm verisi (2.4.6) üzerine mobil tahsilat
elle("E27-eski-surum-verisi", "Veri 2.4.6'nın GERÇEK koduyla girilir (F1 1.000, F2 800, masaüstü tahsilat 600); program 2.4.7'ye yükseltilir; mobil 900 → FIFO eski faturaları sürdürür: "
     "F1 0, F2 300.", ["test kuralı: eski sürüm verisi o sürümün gerçek koduyla", "iş listesi Nasıl bozulur: eski sürüm verisi"],
     bas(simdi="2026-09-25T10:00:00+03:00", kaynakSurum="2.4.6"),
     [cari("c1", "A", tarih="2026-09-01"), fat("f1", "F1", "A", "1000", "2026-09-10"), fat("f2", "F2", "A", "800", "2026-09-20"),
      tah("t0", "A", "600", ch("masaustu")), ort("v", "surum_yukselt", surum="2.4.7"), saat("s1", "2026-10-20T10:00:00+03:00"), tah("t1", "A", "900", ch("mobil")),
      kon("k1")],
     birles(AD("t0", "ok"), AD("t1", "ok"), KB("k1", cari={"A": (300, 2)}, fatura={"F1": 0, "F2": 300}, kasa=1500, kasaGun={"2026-09-25": 600, D1: 900})))

# E28 — rol yetkisi mobilde de aynı (mobil yetki atlatma yolu değildir)
elle("E28-rol-yetkisi", "Personel mobilde: nakit / havale / POS tahsilatı ve taksit tahsilatı 200; havale ve Kredi Kartı ödemesi 403 (masaüstünde de 403); Fazlasını Avans Yaz 403 "
     "plan-overpay-permission.", ["PLAN §2.5 accounts.collect / plans.collect herkese", "PLAN §9.2/3 bankadan çıkış bank.move", "PLAN §3.10/3 plans.manage"],
     bas(kullanicilar={"P": {"rol": "personel", "uzak": True}}, cihazlar={"DY": "Y", "DP": "P"}),
     [hesap("h1", "BNK1", "banka"), hesap("h2", "POS1", "pos"), hesap("h3", "KK1", "kart"), cari("c1", "A"), cari("c2", "T", tur="tedarikci"),
      cari("c3", "K", acilis="300"), fat("f1", "AF1", "T", "1000", "2026-10-01", tur="alis"), kart("ka", "KT", "K", "300", 1),
      tah("t1", "A", "100", ch("mobil", "DP")), tah("t2", "A", "100", ch("mobil", "DP"), yol="havale"), tah("t3", "A", "100", ch("mobil", "DP"), yol="pos"),
      ode("t4", "T", "100", ch("mobil", "DP"), yol="havale"), ode("t5", "T", "100", ch("mobil", "DP"), yol="kart"), tah("t6", "K", "100", ch("mobil", "DP"), kart="KT"),
      tah("t7", "K", "300", ch("mobil", "DP"), kart="KT", fazlaAvans=True), ode("t8", "T", "100", ch("masaustu", kullanici="P"), yol="havale"), kon("k1")],
     birles(AD("t1", "ok"), AD("t2", "ok"), AD("t3", "ok"), AD("t4", "ret", 403), AD("t5", "ret", 403), AD("t6", "ok"),
            AD("t7", "ret", 403, "plan-overpay-permission"), AD("t8", "ret", 403),
            KB("k1", cari={"A": (-300, 3), "T": (-1000, 0), "K": (200, 0)}, fatura={"AF1": 1000}, kartlar={"KT": (100, 0, 200, 1, [100])}, kasa=200,
               kasaGun={D1: 200}, hesaplar={"BNK1": ("banka", 100), "POS1": ("pos", 100), "KK1": ("kartHesap", 0)})),
     pg={"onay=gecemez": AD("t7", "ret", 409, "plan-overpay"),
         "taksit=yalniz_cari": birles(AD("t6", "ret", "4xx"), AD("t7", "ret", "4xx"),
                                      KB("k1", cari={"A": (-300, 3), "T": (-1000, 0), "K": (300, 0)}, fatura={"AF1": 1000}, kartlar={"KT": (0, 0, 300, 0, [0])},
                                         kasa=100, kasaGun={D1: 100}, hesaplar={"BNK1": ("banka", 100), "POS1": ("pos", 100), "KK1": ("kartHesap", 0)})),
         "taksit=yalniz_cari&onay=gecemez": AD("t7", "ret", "4xx")})

# E29 — Benzer İşlem (mobil + masaüstü aynı anahtar)
elle("E29-benzer-islem", "Aynı gün aynı hesaba aynı cariden aynı tutar havale: ikincisi 409 bank-similar; 'Yine de Kaydet' (benzerOnay) ile yazılır (mobil 'geçemez' kipinde "
     "yazılmaz); masaüstündeki aynısı da 409; nakit iki kez yazılır (PLAN: nakit denetlenmez).",
     ["PLAN §3.10/2", "S4 PARAMETRE"],
     bas(), [hesap("h1", "BNK1", "banka"), cari("c1", "A"), tah("t1", "A", "500", ch("mobil"), yol="havale"), tah("t2", "A", "500", ch("mobil"), yol="havale"),
             tah("t3", "A", "500", ch("mobil"), yol="havale", benzerOnay=True), tah("t4", "A", "500", ch("masaustu"), yol="havale"),
             tah("t5", "A", "500", ch("mobil")), tah("t6", "A", "500", ch("mobil")), kon("k1")],
     birles(AD("t1", "ok"), AD("t2", "ret", 409, "bank-similar"), AD("t3", "ok"), AD("t4", "ret", 409, "bank-similar"), AD("t5", "ok"), AD("t6", "ok"),
            KB("k1", cari={"A": (-2000, 4)}, kasa=1000, kasaGun={D1: 1000}, hesaplar={"BNK1": ("banka", 1000)})),
     pg={"onay=gecemez": birles(AD("t3", "ret", 409, "bank-similar"), KB("k1", cari={"A": (-1500, 3)}, kasa=1000, kasaGun={D1: 1000}, hesaplar={"BNK1": ("banka", 500)}))})

# E30 — eşdeğerlik: Kasa eksi bakiye (Uyar / Engelle)
elle("E30-es-kasa-eksi", "Kasa 100 (Uyar): nakit ödeme 300 → 409 cash-negative; 'Yine de Kaydet' → Kasa −200; Engelle'ye geçince 50 → 409 cash-blocked ('geçemez' kipinde Kasa 100 "
     "kaldığı için 50 yazılır).", ["PLAN §3.9 / SENARYO-DILI §5.3", "S4 PARAMETRE"],
     bas(sirketler={"001": {"kasaEksi": "uyar"}}),
     lambda kn: [{"id": "ka", "islem": "kasa_acilis", "tutar": "100", "tarih": "2026-10-01"}, cari("c1", "T", tur="tedarikci"),
                 fat("f1", "AF1", "T", "1000", "2026-10-02", tur="alis"), ode("o1", "T", "300", ch(kn)), ode("o2", "T", "300", ch(kn), yineDeKaydet=True),
                 {"id": "ay", "islem": "ayar", "kasaEksi": "engelle"}, ode("o3", "T", "50", ch(kn), yineDeKaydet=True), kon("k1")],
     birles(AD("o1", "ret", 409, "cash-negative"), AD("o2", "ok"), AD("o3", "ret", 409, "cash-blocked"),
            KB("k1", cari={"T": (-700, 1)}, fatura={"AF1": 700}, kasa=-200, kasaGun={"2026-10-01": 100, D1: -300})),
     pg={"onay=gecemez": birles(AD("o2", "ret", 409, "cash-negative"), AD("o3", "ok"),
                                KB("k1", cari={"T": (-950, 1)}, fatura={"AF1": 950}, kasa=50, kasaGun={"2026-10-01": 100, D1: -50}))},
     cift=True)

# E31 — eşdeğerlik: çek / senet tahsilatı
elle("E31-es-evrak", "A: F1 1.000. Çek 400 (mobil 'evrak dahil' kipinde) ve masaüstü senet 300: portföye girer, Kasa'ya girmez, en eski faturayı kapatır. Önerilen kipte mobil çek "
     "reddedilir.", ["PLAN §3.11a", "BAŞ MİMAR S1 (çek/senet bağsız ödeme)", "S2 PARAMETRE"],
     bas(), lambda kn: [cari("c1", "A"), fat("f1", "F1", "A", "1000", "2026-10-01"), tah("t1", "A", "400", ch(kn), yol="cek"),
                        tah("t2", "A", "300", ch("masaustu"), yol="senet"), kon("k1")],
     birles(AD("t1", "ret", "4xx"), AD("t2", "ok"), KB("k1", cari={"A": (700, 0)}, fatura={"F1": 700}, portfoy=300, evrak=1)),
     pg={"yollar=evrak_dahil": birles(AD("t1", "ok"), KB("k1", cari={"A": (300, 0)}, fatura={"F1": 300}, portfoy=700, evrak=2))},
     cift=True)

# E32 — aynı gün masaüstü + mobil, yazım sırası (ders 31)
for _ad, _sira in (("E32a-ayni-gun-sira", ("t1", "t3", "t2")), ("E32b-ayni-gun-sira", ("t3", "t2", "t1"))):
    _adim = {"t1": tah("t1", "A", "300", ch("masaustu")), "t2": tah("t2", "A", "500", ch("mobil")), "t3": tah("t3", "A", "100", ch("masaustu"), fatura="F2")}
    elle(_ad, "Aynı gün F1 600 ve F2 400; masaüstü 300 bağsız, masaüstü 100 Kapatılacak = F2, mobil 500 bağsız — iki farklı yazım sırasında da F1 0, F2 100.",
         ["ders 31 aynı tarihli kayıtlar", "BAŞ MİMAR S1"],
         bas(), [cari("c1", "A"), fat("f1", "F1", "A", "600", D1), fat("f2", "F2", "A", "400", D1)] + [_adim[x] for x in _sira] + [kon("k1")],
         birles(AD("t1", "ok"), AD("t2", "ok"), AD("t3", "ok"), KB("k1", cari={"A": (100, 3)}, fatura={"F1": 0, "F2": 100}, kasa=900, kasaGun={D1: 900})))

# E34 — aynı kimlik iki şirkette
elle("E34-iki-sirket-ayni-kimlik", "Aynı kullanıcı aynı istek kimliğini 001 ve 002'de kullanır: iki ayrı kayıt (istek kimlikleri şirketin veri dosyasında).",
     ["ÇIKARIM PLAN request_keys şirket tablolarında + 'Şirket = ayrı veri dosyası'"],
     bas(sirketler={"001": {}, "002": {}}),
     [cari("c1", "A1"), cari("c2", "B1", sirket="002"), tah("t1", "A1", "100", ch("mobil"), ik="ortak-1"), tah("t2", "B1", "100", ch("mobil"), ik="ortak-1", sirket="002"),
      kon("k1")],
     birles(AD("t1", "ok"), AD("t2", "ok"), KB("k1", "001", cari={"A1": (-100, 1)}, kasa=100, kasaGun={D1: 100}),
            KB("k1", "002", cari={"B1": (-100, 1)}, kasa=100, kasaGun={D1: 100})))

# E35 — aynı kimlik iki kullanıcıda
elle("E35-iki-kullanici-ayni-kimlik", "İki kullanıcı aynı kimliği (aynı içerik) gönderir: anahtar kullanıcıyı içerir → iki kayıt.",
     ["PLAN §3.10/1 'anahtar kullanıcı|kapsam|kimlik'"],
     bas(kullanicilar={"M": {"rol": "muhasebe", "uzak": True, "sirketler": ["001"]}}, cihazlar={"DY": "Y", "DM": "M"}),
     [cari("c1", "A"), tah("t1", "A", "100", ch("mobil"), ik="k-1"), tah("t2", "A", "100", ch("mobil", "DM"), ik="k-1"), kon("k1")],
     birles(AD("t1", "ok"), AD("t2", "ok"), KB("k1", cari={"A": (-200, 2)}, kasa=200, kasaGun={D1: 200})))

# E36 — cihaz yarıda silindi
elle("E36-cihaz-sil-yarida", "Biri yazılmış biri ulaşmamış iki belirsiz istek; cihaz silinir; yeniden gönderimler reddedilir; yazılmış kayıt durur (1).",
     ["iş listesi M2 cihaz silme", "PLAN §3.10/1"],
     bas(), [cari("c1", "A"), tah("t1", "A", "100", ch("mobil"), kesinti="sonra"), tah("t2", "A", "50", ch("mobil"), kesinti="once"),
             ort("d1", "cihaz_sil", cihaz="DY"), yen("y1", "t1"), yen("y2", "t2"), ort("d2", "cihaz_esle", cihaz="DY2", kullanici="Y"), kon("k1")],
     birles(AD("t1", "belirsiz", sunucu="ok"), AD("t2", "belirsiz", sunucu="yok"), AD("y1", "ret", "4xx"), AD("y2", "ret", "4xx"),
            KB("k1", cari={"A": (-100, 1)}, kasa=100, kasaGun={D1: 100})))

# E37 — belirsiz istek, sonra sunucu kapandı
elle("E37-sunucu-kapali-yarida", "Ulaşmamış istek; sunucu kapandı; yeniden gönderim ulaşılamadı; açılınca yeniden gönderim bir kez yazar.",
     ["KULLANICI sunucu kapalı yazma yok", "PLAN §3.10/1"],
     bas(), [cari("c1", "A"), tah("t1", "A", "100", ch("mobil"), kesinti="once"), ort("s1", "sunucu", durum="kapali"), yen("y1", "t1"),
             ort("s2", "sunucu", durum="acik"), yen("y2", "t1"), kon("k1")],
     birles(AD("t1", "belirsiz", sunucu="yok"), AD("y1", "ulasilamadi"), AD("y2", "ok"), KB("k1", cari={"A": (-100, 1)}, kasa=100, kasaGun={D1: 100})))

# E38 — silinip aynı adla yeniden açılan cari
elle("E38-sil-ayni-adla-ac", "Hareketsiz X ('Veli Kaya') silindi, aynı adla X2 açıldı; telefonun eski listesindeki X'e tahsilat 404, X2'ye yazılmaz.",
     ["test kuralı 'sil + aynı adla yeniden aç'", "YAYGIN: kimlik değişmez, ada göre eşlenmez"],
     bas(), [cari("c1", "X", "Veli Kaya"), {"id": "cs", "islem": "cari_sil", "cari": "X"}, cari("c2", "X2", "Veli Kaya"),
             tah("t1", "X", "100", ch("mobil")), tah("t2", "X2", "100", ch("mobil")), kon("k1")],
     birles(AD("t1", "ret", 404), AD("t2", "ok"), KB("k1", cari={"X2": (-100, 1)}, kasa=100, kasaGun={D1: 100})))


# E39 — çift dokunuş: aynı istek aynı anda iki kez
elle("E39-cift-dokunus-ayni-anda", "Telefonda çift dokunuş ya da tünelin isteği iki kez iletmesi: aynı kimlik + aynı içerik AYNI ANDA iki kez gelir → tek kayıt; biri 'zaten "
     "kaydedildi' (hangisi olduğu sıraya bağlı).", ["PLAN §3.10/1 (request_keys yazımla aynı işlemde)", "PLAN §9.2/12"],
     bas(), [cari("c1", "A"), tah("t1", "A", "250", ch("mobil"), ik="cift-1", ayniAnda="g"), tah("t2", "A", "250", ch("mobil"), ik="cift-1", ayniAnda="g"),
             kon("k1")],
     KB("k1", cari={"A": (-250, 1)}, kasa=250, kasaGun={D1: 250}),
     alternatifler=[{"adim:t1:durum": "ok", "adim:t2:durum": "yineleme"}, {"adim:t1:durum": "yineleme", "adim:t2:durum": "ok"}])


# E40 — eşdeğerlik (ders 10, komşu yol): müşteriye ödeme = iade geri ödemesi (KS8.1, K-d)
elle("E40-es-iade-geri-odeme", "M: F1 500 tamamen iade edildi (F1 0, bakiye 0); müşteriye bağsız nakit Ödeme 500 → karşı tarafta yükümlülük ve iade açık notu yok → iadenin geri ödemesi, "
     "F1 YENİDEN AÇILIR (500), bakiye 500. N: F2 300 iade, Ödeme 300 Kapatılacak = iade belgesi I2 (K-d) → F2 300. Mobil yalnız-FIFO kipinde bağlı ödeme reddedilir.",
     ["BAŞ MİMAR KS8.1, KS8.2 + KULLANICI K-b, K-d (cari KARARLAR §10–§11)", "S1 PARAMETRE", "ders 10 değişen ortak yolun komşuları"],
     bas(), lambda kn: [cari("c1", "M"), cari("c2", "N"), fat("f1", "F1", "M", "500", "2026-10-01"), fat("f2", "F2", "N", "300", "2026-10-02"),
                        {"id": "i1", "islem": "iade", "ad": "I1", "fatura": "F1", "tarih": "2026-10-05"},
                        {"id": "i2", "islem": "iade", "ad": "I2", "fatura": "F2", "tarih": "2026-10-06"}, kon("k0"),
                        ode("o1", "M", "500", ch(kn)), ode("o2", "N", "300", ch(kn), fatura="I2"), kon("k1")],
     birles(AD("o1", "ok"), AD("o2", "ok"),
            KB("k0", cari={"M": (0, 0), "N": (0, 0)}, fatura={"F1": 0, "I1": 0, "F2": 0, "I2": 0}, kasa=0),
            KB("k1", cari={"M": (500, 1), "N": (300, 1)}, fatura={"F1": 500, "I1": 0, "F2": 300, "I2": 0}, kasa=-800, kasaGun={D1: -800})),
     pg={"kapatilacak=yalniz_fifo": birles(AD("o2", "ret", "4xx"),
                                           KB("k1", cari={"M": (500, 1), "N": (0, 0)}, fatura={"F1": 500, "I1": 0, "F2": 0, "I2": 0}, kasa=-500, kasaGun={D1: -500}))},
     cift=True)


# ═════════════════════════════════════════════════ GÖRELİ ÇİFTLER (plan yetkiyi söylemiyor — 'B'): program iki kanalda AYNI sonucu vermeli
def _goreli(ad, aciklama, baslangic, adimlar, kosul):
    out = {}
    for kanal in ("masaustu", "mobil"):
        out[kanal] = {"dil": kahin.DIL, "ad": "%s-%s" % (ad, kanal), "aciklama": aciklama, "baslangic": baslangic, "adimlar": adimlar(kanal)}
    return {"ad": ad, "aciklama": aciklama, "kosul": kosul, "masaustu": out["masaustu"], "mobil": out["mobil"]}


def _kn(kanal, kul, cihaz):
    return ch(kanal, cihaz, kul)


GORELI = [
    _goreli("G1-muhasebe-nakit-odeme", "Muhasebe rolünün nakit ödemesi (PLAN §9'da yazılı değil): mobil sonuç masaüstüyle aynı olmalı (mobil yetki atlatma yolu değildir).",
            bas(kullanicilar={"M": {"rol": "muhasebe", "uzak": True, "sirketler": ["001"]}}, cihazlar={"DM": "M"}),
            lambda kn: [{"id": "ka", "islem": "kasa_acilis", "tutar": "1000", "tarih": "2026-10-01"}, cari("c1", "T", tur="tedarikci"),
                        fat("f1", "AF1", "T", "500", "2026-10-02", tur="alis"), ode("o1", "T", "200", _kn(kn, "M", "DM")), kon("k1")], {}),
    _goreli("G2-personel-stok", "Personelin stok girişi (yetkisi planda yok): iki kanal aynı.",
            bas(kullanicilar={"P": {"rol": "personel", "uzak": True}}, cihazlar={"DP": "P"}),
            lambda kn: [{"id": "u1", "islem": "urun_ac", "ad": "U1"}, stk("s1", "U1", "giris", 5, _kn(kn, "P", "DP")), kon("k1")], {"stok_yonu": "giris_cikis"}),
    _goreli("G3-muhasebe-cek", "Muhasebenin çek tahsilatı (cheques.manage rolleri planda yok): iki kanal aynı (mobilde 'evrak dahil' seçilirse).",
            bas(kullanicilar={"M": {"rol": "muhasebe", "uzak": True, "sirketler": ["001"]}}, cihazlar={"DM": "M"}),
            lambda kn: [cari("c1", "A"), fat("f1", "F1", "A", "1000", "2026-10-01"), tah("t1", "A", "300", _kn(kn, "M", "DM"), yol="cek"), kon("k1")],
            {"yollar": "evrak_dahil"}),
    _goreli("G4-muhasebe-fazla-avans", "Muhasebenin Fazlasını Avans Yaz'ı (plans.manage rolleri planda yok): iki kanal aynı (mobilde 'sorar' seçilirse).",
            bas(kullanicilar={"M": {"rol": "muhasebe", "uzak": True, "sirketler": ["001"]}}, cihazlar={"DM": "M"}),
            lambda kn: [cari("c1", "K", acilis="300"), kart("ka", "KT", "K", "300", 1), tah("t1", "K", "400", _kn(kn, "M", "DM"), kart="KT", fazlaAvans=True),
                        kon("k1")], {"onay": "sorar", "taksit": "kart_secilir"}),
]


# ═════════════════════════════════════════════════ denetim ve kabul.json
def _sirala_alt(alt):
    return sorted(alt, key=lambda d: json.dumps(d, sort_keys=True, ensure_ascii=False))


def esit(model, bek):
    """model ve beklenen {beklenen, alternatifler} aynı mı; değilse fark satırları."""
    farklar = []
    e = bek.get("etiket", "elle")   # beklenenin kaynağı: "elle" (uç senaryo) ya da "akış" (üreticinin akış modeli)
    mb, bb = model["beklenen"], bek["beklenen"]
    for k in sorted(set(mb) | set(bb)):
        if k not in mb:
            farklar.append("%s: model yazmadı, %s %s" % (k, e, bb[k]))
        elif k not in bb:
            farklar.append("%s: %s yazmadı, model %s" % (k, e, mb[k]))
        elif mb[k] != bb[k]:
            farklar.append("%s: model %s · %s %s" % (k, json.dumps(mb[k], ensure_ascii=False), e, json.dumps(bb[k], ensure_ascii=False)))
    if _sirala_alt(model["alternatifler"]) != _sirala_alt(bek["alternatifler"]):
        farklar.append("alternatifler: model %s · %s %s" % (json.dumps(_sirala_alt(model["alternatifler"]), ensure_ascii=False)[:400], e,
                                                         json.dumps(_sirala_alt(bek["alternatifler"]), ensure_ascii=False)[:400]))
    return farklar


def model_kos(senaryo, p, mut=0):
    return kahin.Kahin(senaryo, p, mut).kos()


def ilgili_parametreler(sonuclar):
    """sonuclar: {birlesim_adi: çıktı}. Bir parametre, yalnız onu değiştirmek çıktıyı bir birleşimde değiştiriyorsa ilgilidir."""
    ilgili = []
    for k, degerler in P.items():
        for p in kahin.birlesimler():
            q = dict(p, **{k: degerler[1] if p[k] == degerler[0] else degerler[0]})
            if sonuclar[kahin.birlesim_adi(p)] != sonuclar[kahin.birlesim_adi(q)]:
                ilgili.append(k)
                break
    return ilgili


def gruplar(sonuclar, ilgili):
    out = []
    for degerler in itertools.product(*[P[k] for k in ilgili]):
        secim = dict(zip(ilgili, degerler))
        p = dict(ILK, **secim)
        out.append({"secim": secim, **sonuclar[kahin.birlesim_adi(p)]})
    return out


def elle_denetle(kayit, birlesim_listesi=None, mut=0):
    """Elle senaryo: her birleşimde model = elle. Dönüş (fark satırları, {birlesim: model çıktısı})."""
    farklar, sonuclar = [], {}
    for p in (birlesim_listesi or list(kahin.birlesimler())):
        m = model_kos(kayit["senaryo"], p, mut)
        sonuclar[kahin.birlesim_adi(p)] = m
        f = esit(m, elle_beklenen(kayit, p))
        if f:
            farklar.append("[%s] %s" % (kahin.birlesim_adi(p), " | ".join(f[:6])))
    return farklar, sonuclar


def _yaz_json(yol, obj):
    with open(yol, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write("\n")


# ═════════════════════════════════════════════════ RASTGELE ÜRETİCİ + BAĞIMSIZ AKIŞ BEKLENTİSİ
TRZ = kahin.TR
ISIMLER = ["Ahmet Yılmaz", "Ayşe Kaya", "Mehmet Demir", "Fatma Şahin", "Ali Çelik", "Zeynep Arslan", "Mustafa Koç", "Elif Aydın",
           "Hasan Öztürk", "Emine Yıldız", "Hüseyin Kurt", "Hatice Polat"]


def _iso(z):
    return z.isoformat()


def _tl(k):
    return "%d,%02d" % (k // 100, k % 100) if k % 100 else str(k // 100)


class Uretici:
    """Tohumlu rastgele senaryo: 2 şirket, 4 kullanıcı, cihaz değişimi, sunucu/lisans kesintileri, kesinti + yeniden gönderim, aynı kimlik, Benzer İşlem,
    Kasa eksi, K8, stok, ay sonu / gece yarısı, eşzamanlı çiftler (değişmeli: farklı cariler). Plan 'B' hücrelerini (yetkisi yazılı olmayan rol × işlem) kurmaz."""

    BITIS = datetime(2027, 1, 25, 0, 0, tzinfo=TRZ)

    def __init__(self, tohum, olay):
        self.r = random.Random(tohum * 7919 + 17)
        self.tohum = tohum
        self.hedef = olay
        self.simdi = datetime(2026, 10, 1, 8, 0, tzinfo=TRZ)
        self.adimlar = []
        self.n = 0
        self.ik = 0
        self.bekleyen = []          # (zaman, adım id) yeniden gönderilecekler
        self.para_adimlari = []     # aynı kimlikle yeniden gönderilebilecek önceki adımlar
        self.sirket = {}
        self.cihazlar = {"DY1": "Y", "DM1": "M", "DP1": "P"}
        self.aktif = {"DY1", "DM1", "DP1"}
        self.uzak = {"Y": True, "M": True, "P": True, "R": False}
        self.yetki = {"Y": None, "M": ["001", "002"], "P": [], "R": ["002"]}
        self.cihaz_say = {"Y": 1, "M": 1, "P": 1, "R": 0}
        self.sunucu = True
        self.lisans = True

    # ─── yardımcılar
    def yid(self, onek="a"):
        self.n += 1
        return "%s%d" % (onek, self.n)

    def yik(self):
        self.ik += 1
        return "r%d-%06d" % (self.tohum, self.ik)

    def ekle(self, a):
        self.adimlar.append(a)
        return a

    def ilerle(self):
        r = self.r.random()
        if r < 0.25:
            # ay sonuna / gece yarısına yığ (yalnız ay sonuna 3 günden az kalmışsa): ayın son günü 23:59:5x, sonra ertesi gün 00:00:0x
            z = self.simdi
            ay_son = (date(z.year + (z.month == 12), z.month % 12 + 1, 1) - timedelta(days=1))
            hedef = datetime(ay_son.year, ay_son.month, ay_son.day, 23, 59, 50 + self.r.randint(0, 8), tzinfo=TRZ)
            if z < hedef <= z + timedelta(days=3):
                self.simdi = hedef
                self.ekle(saat(self.yid("s"), _iso(self.simdi)))
                return
        dk = self.r.choice([1, 2, 5, 10, 20, 45, 90, 180, 360])
        z = self.simdi + timedelta(minutes=dk, seconds=self.r.randint(0, 59))
        if z.hour < 8 and self.r.random() < 0.8:
            z = z.replace(hour=8 + self.r.randint(0, 2))
        if z < self.BITIS:
            self.simdi = z
            self.ekle(saat(self.yid("s"), _iso(self.simdi)))

    def sirket_sec(self, k):
        """Kanal seçildikten sonra şirket: %85 kullanıcının yetkili olduğu şirketlerden (yetkisiz şirket denemesi de kalsın)."""
        u = k.get("kullanici") or self.cihazlar.get(k.get("cihaz"))
        yetkili = ["001", "002"] if self.yetki[u] is None else (self.yetki[u] or ["001"])
        return self.r.choice(sorted(yetkili)) if self.r.random() < 0.85 else self.r.choice(["001", "002"])

    def kanal_sec(self, islem, yol=None, kart=False, fazla=False):
        """İşleme yetkili (B olmayan) bir kanal: Y her şeyi yapar; M ve P/R yalnız planın yazdığı yolları."""
        sadece_y = (islem == "stok") or (islem == "odeme" and yol == "nakit") or (islem == "tahsilat" and yol in ("cek", "senet"))
        if islem == "tahsilat" and kart and fazla:
            kul = ["Y", "P", "R"]          # M (muhasebe) plans.manage planda yok → B
        elif sadece_y:
            kul = ["Y"]
        else:
            kul = ["Y", "M", "P", "R"]
        mobil = self.r.random() < (0.7 if self.sunucu and self.lisans else 1.0)
        if not self.sunucu or not self.lisans:
            mobil = True                   # sunucu / lisans kesintisinde masaüstü adımı kurulmaz
        if mobil:
            adaylar = [c for c, u in self.cihazlar.items() if u in kul]
            if self.r.random() < 0.9:
                etkin = [c for c in adaylar if c in self.aktif]
                adaylar = etkin or adaylar
            if adaylar:
                return {"kanal": "mobil", "cihaz": self.r.choice(sorted(adaylar))}
            if not self.sunucu or not self.lisans:
                return None
        return {"kanal": "masaustu", "kullanici": self.r.choice(kul) if self.r.random() < 0.5 else kul[0]}

    # ─── kurulum
    def kur(self):
        for s, ek in (("001", "1"), ("002", "2")):
            S = {"musteri": [], "tedarikci": [], "kartli": [], "fatura": {}, "alis": {}, "urun": []}
            self.sirket[s] = S
            self.ekle({"id": self.yid("ka"), "islem": "kasa_acilis", "sirket": s, "tutar": "5000", "tarih": "2026-10-01"})
            for h, tur in (("BNK%s1" % ek, "banka"), ("BNK%s2" % ek, "banka"), ("POS%s1" % ek, "pos"), ("KK%s1" % ek, "kart")):
                self.ekle(hesap(self.yid("h"), h, tur, sirket=s))
            for i in range(1, 13):
                ad = "C%s_%02d" % (ek, i)
                acilis = str(self.r.choice([500, 1200, 2500, 3000])) if self.r.random() < 0.4 else None
                self.ekle(cari(self.yid("c"), ad, self.r.choice(ISIMLER), acilis=acilis, sirket=s))
                S["musteri"].append(ad)
            for i in range(1, 5):
                ad = "T%s_%d" % (ek, i)
                self.ekle(cari(self.yid("c"), ad, "Tedarikçi %s-%d" % (ek, i), tur="tedarikci", sirket=s))
                S["tedarikci"].append(ad)
            for i in range(1, 4):
                ad, kad = "K%s_%d" % (ek, i), "KT%s_%d" % (ek, i)
                t = self.r.choice([1200, 2400, 3600, 4000])
                self.ekle(cari(self.yid("c"), ad, self.r.choice(ISIMLER), acilis=str(t), sirket=s))
                self.ekle(kart(self.yid("kt"), kad, ad, str(t), self.r.randint(2, 6), sirket=s))
                S["kartli"].append((ad, kad))
            for i in range(1, 5):
                u = "U%s_%d" % (ek, i)
                self.ekle({"id": self.yid("u"), "islem": "urun_ac", "ad": u, "sirket": s})
                self.ekle(stk(self.yid("g"), u, "giris", self.r.randint(20, 100), ch("masaustu"), ik=self.yik(), sirket=s))
                S["urun"].append(u)

    # ─── olaylar
    def tutar(self, alt=50, ust=3000):
        k = self.r.randint(alt, ust) * 100
        if self.r.random() < 0.2:
            k += self.r.randint(1, 99)
        return _tl(k)

    def satis(self):
        s = self.r.choice(["001", "002"])
        c = self.r.choice(self.sirket[s]["musteri"])
        ad = "F%s_%d" % (s[-1], len(self.sirket[s]["fatura"]) + 1)
        self.ekle(fat(self.yid("f"), ad, c, self.tutar(100, 5000), self.simdi.date().isoformat(), sirket=s))
        self.sirket[s]["fatura"][ad] = c

    def alis(self):
        s = self.r.choice(["001", "002"])
        c = self.r.choice(self.sirket[s]["tedarikci"])
        ad = "AF%s_%d" % (s[-1], len(self.sirket[s]["alis"]) + 1)
        self.ekle(fat(self.yid("f"), ad, c, self.tutar(100, 4000), self.simdi.date().isoformat(), tur="alis", sirket=s))
        self.sirket[s]["alis"][ad] = c

    def _ortak(self, a):
        r = self.r.random()
        ilk_gun = self.simdi.date() <= date(2026, 10, 2)   # carilerin açılış günü 01.10: ondan önceye tarih kurulmaz
        if a.get("kanal") == "mobil":
            if r < 0.03:
                a["tarih"] = (self.simdi.date() + timedelta(days=self.r.choice([1] if ilk_gun else [-1, 1]))).isoformat()
            elif r < 0.06:
                a["formAcilis"] = _iso(self.simdi - timedelta(minutes=self.r.randint(1, 15)))
            if self.r.random() < 0.08:
                a["kesinti"] = self.r.choice(["once", "sonra"])
        elif r < 0.05 and not ilk_gun:
            a["tarih"] = (self.simdi.date() - timedelta(days=1)).isoformat()
        return a

    def tahsilat(self):
        yol = self.r.choices(["nakit", "havale", "pos", "cek", "senet"], [50, 22, 16, 8, 4])[0]
        k = self.kanal_sec("tahsilat", yol)
        if k is None:
            return
        s = self.sirket_sec(k)
        S = self.sirket[s]
        if self.r.random() < 0.04:
            c = self.r.choice(self.sirket["002" if s == "001" else "001"]["musteri"])   # başka şirketin carisi
        elif self.r.random() < 0.05:
            c = self.r.choice(S["kartli"])[0]                                            # taksit kartlı cariye taksit dışı tahsilat
        else:
            c = self.r.choice(S["musteri"])
        tutar = self.tutar(20, 2500)
        if self.r.random() < 0.015:
            tutar = self.r.choice(["0", "12,345", "-5", "1.234,56"])
        kw = {}
        if yol == "havale":
            if self.r.random() < 0.85:
                kw["hesap"] = self.r.choice(["BNK%s1" % s[-1], "BNK%s2" % s[-1]])
        elif yol == "pos" and self.r.random() < 0.3:
            kw["hesap"] = "POS%s1" % s[-1]
        faturalar = [f for f, x in S["fatura"].items() if x == c]
        if self.r.random() < 0.15 and S["fatura"]:
            kw["fatura"] = self.r.choice(faturalar) if (faturalar and self.r.random() < 0.85) else self.r.choice(sorted(S["fatura"]))
        a = self.ekle(self._ortak(tah(self.yid("t"), c, tutar, k, yol=yol, ik=self.yik(), sirket=s, **kw)))
        self._sonra(a)
        if yol == "havale" and kw.get("hesap") and self.r.random() < 0.15:
            b = dict(a, id=self.yid("t"), istekKimligi=self.yik())     # aynı gün aynı hesap aynı tutar → Benzer İşlem
            b.pop("kesinti", None)
            if self.r.random() < 0.4:
                b["benzerOnay"] = True
            self.ekle(b)

    def kart_tah(self):
        fazla = self.r.random() < 0.12
        k = self.kanal_sec("tahsilat", "nakit", kart=True, fazla=fazla)
        if k is None:
            return
        s = self.sirket_sec(k)
        c, kad = self.r.choice(self.sirket[s]["kartli"])
        yol = self.r.choices(["nakit", "havale", "pos"], [70, 20, 10])[0]
        kw = {"kart": kad}
        if fazla:
            kw["fazlaAvans"] = True
        if yol == "havale":
            kw["hesap"] = "BNK%s1" % s[-1]
        a = self.ekle(self._ortak(tah(self.yid("t"), c, self.tutar(50, 600), k, yol=yol, ik=self.yik(), sirket=s, **kw)))
        self._sonra(a)

    def odeme(self):
        yol = self.r.choices(["nakit", "havale", "kart"], [45, 35, 20])[0]
        k = self.kanal_sec("odeme", yol)
        if k is None:
            return
        s = self.sirket_sec(k)
        S = self.sirket[s]
        c = self.r.choice(S["tedarikci"])
        kw = {}
        if yol == "havale":
            kw["hesap"] = self.r.choice(["BNK%s1" % s[-1], "BNK%s2" % s[-1]])
        alislar = [f for f, x in S["alis"].items() if x == c]
        if alislar and self.r.random() < 0.2:
            kw["fatura"] = self.r.choice(alislar)
        if yol == "nakit" and self.r.random() < 0.5:
            kw["yineDeKaydet"] = True
        a = self.ekle(self._ortak(ode(self.yid("o"), c, self.tutar(50, 4000), k, yol=yol, ik=self.yik(), sirket=s, **kw)))
        self._sonra(a)

    def stok(self):
        k = self.kanal_sec("stok")
        if k is None:
            return
        s = self.sirket_sec(k)
        yon = self.r.choice(["giris", "cikis", "cikis"])
        kw = {"eksiOnay": True} if self.r.random() < 0.3 else {}
        a = self.ekle(self._ortak(stk(self.yid("st"), self.r.choice(self.sirket[s]["urun"]), yon, self.r.randint(1, 40), k, ik=self.yik(), sirket=s, **kw)))
        self._sonra(a)

    def _sonra(self, a):
        if a.get("kesinti"):
            r = self.r.random()
            dk = self.r.randint(5, 120) if r < 0.7 else (self.r.randint(120, 1200) if r < 0.9 else self.r.randint(1500, 4300))
            self.bekleyen.append((self.simdi + timedelta(minutes=dk), a["id"]))
        if a["islem"] in ("tahsilat", "odeme", "stok"):
            self.para_adimlari.append((self.simdi, a))

    def tekrar(self):
        yakin = [a for z, a in self.para_adimlari[-60:] if self.simdi - z < timedelta(days=20)]   # istek kimliği 30 gün hatırlanır: çatal kurulmaz
        if not yakin:
            return
        a = self.r.choice(yakin)
        if a["kanal"] == "mobil" and (not self.sunucu or not self.lisans):
            pass
        elif a["kanal"] == "masaustu" and (not self.sunucu or not self.lisans):
            return
        b = {k: v for k, v in a.items() if k not in ("kesinti", "ayniAnda", "formAcilis")}
        b["id"] = self.yid("d")
        if self.r.random() < 0.25 and b["islem"] != "stok":
            b["tutar"] = _tl(kahin.kurus(b["tutar"]) + 100) if kahin.kurus(b["tutar"]) else "77"     # aynı kimlik, farklı gövde → 409
        self.ekle(b)

    def yeniden(self):
        hazir = [x for x in self.bekleyen if x[0] <= self.simdi]
        for x in hazir[:2]:
            self.bekleyen.remove(x)
            y = {"id": self.yid("y"), "islem": "yeniden_gonder", "adim": x[1]}
            if self.r.random() < 0.08:
                y["kesinti"] = self.r.choice(["once", "sonra"])
                self.bekleyen.append((self.simdi + timedelta(minutes=self.r.randint(5, 300)), x[1]))
            self.ekle(y)

    def esanli(self):
        k1 = self.kanal_sec("tahsilat", "nakit")
        k2 = self.kanal_sec("tahsilat", "nakit")
        if k1 is None or k2 is None:
            return
        s = self.sirket_sec(k1)
        c1, c2 = self.r.sample(self.sirket[s]["musteri"], 2)
        g = "g%d" % self.n
        adim = []
        for c, k in ((c1, k1), (c2, k2)):
            adim.append(tah(self.yid("t"), c, self.tutar(20, 800), k, ik=self.yik(), sirket=s, ayniAnda=g))
        for a in adim:
            self.ekle(a)
            self.para_adimlari.append((self.simdi, a))

    def ortam(self):
        r = self.r.random()
        if not self.sunucu and r < 0.6:
            self.ekle(ort(self.yid("e"), "sunucu", durum="acik"))
            self.sunucu = True
            return
        if not self.lisans and r < 0.6:
            self.ekle(ort(self.yid("e"), "lisans", durum="gecerli"))
            self.lisans = True
            return
        if r < 0.25 and self.sunucu:
            self.ekle(ort(self.yid("e"), "sunucu", durum="kapali"))
            self.sunucu = False
        elif r < 0.35 and not self.sunucu:
            self.ekle(ort(self.yid("e"), "sunucu", durum="acik"))
            self.sunucu = True
        elif r < 0.42 and self.sunucu:
            self.ekle(ort(self.yid("e"), "sunucu", durum="yeniden"))
        elif r < 0.50 and self.lisans and self.sunucu:
            self.ekle(ort(self.yid("e"), "lisans", durum="bitti"))
            self.lisans = False
        elif r < 0.60 and not self.lisans:
            self.ekle(ort(self.yid("e"), "lisans", durum="gecerli"))
            self.lisans = True
        elif r < 0.72:
            sil = [c for c in sorted(self.aktif) if c != "DY1"]
            if sil:
                c = self.r.choice(sil)
                self.ekle(ort(self.yid("e"), "cihaz_sil", cihaz=c))
                self.aktif.discard(c)
        elif r < 0.84:
            if len(self.aktif) < 3:
                kul = self.r.choice([u for u in ("M", "P", "R", "Y") if self.uzak[u]])
                self.cihaz_say[kul] += 1
                c = "D%s%d" % (kul, self.cihaz_say[kul])
                self.ekle(ort(self.yid("e"), "cihaz_esle", cihaz=c, kullanici=kul))
                self.cihazlar[c] = kul
                self.aktif.add(c)
        elif r < 0.92:
            kul = self.r.choice(["P", "R"])
            deger = not self.uzak[kul]
            self.ekle(ort(self.yid("e"), "uzak_izin", kullanici=kul, deger=deger))
            self.uzak[kul] = deger
            if not deger:
                for c, u in self.cihazlar.items():
                    if u == kul:
                        self.aktif.discard(c)
        else:
            kul = self.r.choice(["P", "R", "M"])
            yeni = self.r.choice([[], ["001"], ["002"], ["001", "002"]])
            self.ekle(ort(self.yid("e"), "sirket_yetki", kullanici=kul, sirketler=yeni))
            self.yetki[kul] = yeni

    def uret(self):
        self.kur()
        kontrol_noktalari = {int(self.hedef * 0.33), int(self.hedef * 0.66)}
        olay = 0
        while olay < self.hedef:
            olay += 1
            self.ilerle()
            self.yeniden()
            if olay in kontrol_noktalari and self.sunucu:
                self.ekle(kon(self.yid("k")))
                continue
            if not self.sunucu or not self.lisans:
                secim = self.r.choices(["tahsilat", "ortam", "kart"], [60, 30, 10])[0]
            else:
                secim = self.r.choices(["satis", "alis", "tahsilat", "kart", "odeme", "stok", "tekrar", "esanli", "ortam"],
                                       [12, 4, 36, 8, 10, 8, 4, 3, 3])[0]
            {"satis": self.satis, "alis": self.alis, "tahsilat": self.tahsilat, "kart": self.kart_tah, "odeme": self.odeme, "stok": self.stok,
             "tekrar": self.tekrar, "esanli": self.esanli, "ortam": self.ortam}[secim]()
        if not self.sunucu:
            self.ekle(ort(self.yid("e"), "sunucu", durum="acik"))
        if not self.lisans:
            self.ekle(ort(self.yid("e"), "lisans", durum="gecerli"))
        self.ilerle()
        for z, i in sorted(self.bekleyen):
            if z <= self.simdi:
                self.ekle({"id": self.yid("y"), "islem": "yeniden_gonder", "adim": i})
        self.ekle(kon(self.yid("k")))
        ad = "R%d-rastgele-tohum%d" % (self.tohum, self.tohum)
        return {"dil": kahin.DIL, "ad": ad,
                "aciklama": "Rastgele (tohum %d, %d olay): 2 şirket, 4 kullanıcı, cihaz değişimi, sunucu/lisans kesintisi, kesinti + yeniden gönderim, aynı kimlik, Benzer "
                            "İşlem, Kasa eksi (001 Uyar, 002 Engelle), K8, stok, ay sonu/gece yarısı, eşzamanlı çiftler." % (self.tohum, len(self.adimlar)),
                "baslangic": {"simdi": "2026-10-01T08:00:00+03:00", "sirketler": {"001": {"kasaEksi": "uyar"}, "002": {"kasaEksi": "engelle"}},
                              "kullanicilar": {"M": {"rol": "muhasebe", "uzak": True, "sirketler": ["001", "002"]},
                                               "P": {"rol": "personel", "uzak": True, "sirketler": []},
                                               "R": {"rol": "personel", "uzak": False, "sirketler": ["002"]}},
                              "cihazlar": {"DY1": "Y", "DM1": "M", "DP1": "P"}},
                "adimlar": self.adimlar}


class Akis:
    """Üreticinin BAĞIMSIZ akış beklentisi: kahin.py'yi ve cari kâhinini KULLANMAZ. Kapıları (sunucu, kesinti, lisans, cihaz, uzak izni, şirket, rol,
    girdi, mobil kısıt, istek kimliği, hedef, kilit, K8, Benzer İşlem, Kasa eksi, eksi stok) ve para sonucunu (Kasa / banka / POS / kart hesabı, cari bakiye,
    FIFO fatura açığı, açılış kalanı, taksit kartı, stok) kendi tablosuyla yeniden hesaplar. Yalnız üreticinin kurduğu alt küme (müşteriye tahsilat, tedarikçiye
    ödeme, bağlı/bağsız, çek/senet, Mevcut Borç kartı; iade / elle borç / evrak işlemleri / budama çatalı YOK)."""

    def __init__(self, senaryo, p):
        self.s, self.p = senaryo, p
        b = senaryo["baslangic"]
        self.simdi = kahin.zaman(b["simdi"])
        self.sunucu, self.lisans = True, True
        self.kul = {"Y": {"rol": "yonetici", "uzak": True, "sir": None}}
        for ad, u in b["kullanicilar"].items():
            self.kul[ad] = {"rol": u["rol"], "uzak": u["uzak"], "sir": list(u.get("sirketler", []))}
        self.cih = {c: {"u": u, "on": True} for c, u in b["cihazlar"].items()}
        self.sir = {k: {"eksi": v.get("kasaEksi", "kontrol_yok"), "cari": {}, "sira": [], "fat": {}, "kart": {}, "hes": {}, "urun": {},
                        "kasa": [], "hesap": {}, "hesapsiz": {}, "port": 0, "evr": 0, "kay": [], "benzer": set(), "n": 0}
                    for k, v in b["sirketler"].items()}
        self.ist = {}
        self.bek = {}
        self.out = {}

    def gun(self):
        return self.simdi.date().isoformat()

    def sonuc(self, i, durum, http=None, kod=None, sunucu=None):
        self.out["adim:%s:durum" % i] = durum
        for alan, v in (("http", http), ("kod", kod), ("sunucu", sunucu)):
            if v is not None:
                self.out["adim:%s:%s" % (i, alan)] = v

    def kos(self):
        for a in self.s["adimlar"]:
            getattr(self, "_" + a["islem"])(a)
        return self.out

    # kurulum / ortam
    def _kasa_acilis(self, a):
        self.sir[a["sirket"]]["kasa"].append((a["tarih"], kahin.kurus(a["tutar"])))

    def _hesap_ac(self, a):
        self.sir[a["sirket"]]["hes"][a["ad"]] = a["tur"]
        self.sir[a["sirket"]]["hesap"][a["ad"]] = 0

    def _cari_ac(self, a):
        S = self.sir[a["sirket"]]
        S["n"] += 1
        S["cari"][a["ad"]] = {"tur": a["tur"], "acilis": kahin.kurus(a["acilis"]) if a.get("acilis") else 0, "tarih": a["tarih"], "n": S["n"]}
        S["sira"].append(a["ad"])

    def _kart_ac(self, a):
        t, n = kahin.kurus(a["tutar"]), int(a["taksit"])
        pay = [t // n] * n
        pay[-1] += t - sum(pay)
        self.sir[a["sirket"]]["kart"][a["ad"]] = {"cari": a["cari"], "top": t, "tk": pay, "od": []}

    def _fatura(self, a):
        S = self.sir[a["sirket"]]
        S["n"] += 1
        S["fat"][a["ad"]] = {"cari": a["cari"], "tur": a["tur"], "tutar": kahin.kurus(a["tutar"]), "tarih": a["tarih"], "n": S["n"]}

    def _urun_ac(self, a):
        self.sir[a["sirket"]]["urun"][a["ad"]] = []

    def _saat(self, a):
        self.simdi = kahin.zaman(a["simdi"])

    def _sunucu(self, a):
        self.sunucu = a["durum"] != "kapali"

    def _lisans(self, a):
        self.lisans = a["durum"] == "gecerli"

    def _cihaz_sil(self, a):
        self.cih[a["cihaz"]]["on"] = False

    def _cihaz_esle(self, a):
        self.cih[a["cihaz"]] = {"u": a["kullanici"], "on": True}

    def _uzak_izin(self, a):
        self.kul[a["kullanici"]]["uzak"] = a["deger"]
        if not a["deger"]:
            for c in self.cih.values():
                if c["u"] == a["kullanici"]:
                    c["on"] = False

    def _sirket_yetki(self, a):
        self.kul[a["kullanici"]]["sir"] = list(a["sirketler"])

    # para
    def _tahsilat(self, a):
        self._istek(a, a, self.simdi, a.get("kesinti"), False)

    _odeme = _tahsilat
    _stok = _tahsilat

    def _yeniden_gonder(self, a):
        orj, form = self.bek[a["adim"]]
        if orj["kanal"] == "mobil" and self.p["gec_yeniden"] == "telefon_24s" and self.simdi - form > timedelta(hours=24):
            self.sonuc(a["id"], "atildi")
            return
        self._istek(dict(orj, id=a["id"]), orj, form, a.get("kesinti"), True)
        self.bek[a["id"]] = (orj, form)

    def _istek(self, a, orj, form, kesinti, yeniden):
        i = a["id"]
        if not yeniden:
            form = kahin.zaman(a["formAcilis"]) if a.get("formAcilis") else self.simdi
            self.bek[i] = (a, form)
        mob = a["kanal"] == "mobil"
        if not self.sunucu:
            return self.sonuc(i, "ulasilamadi")
        if kesinti == "once":
            return self.sonuc(i, "belirsiz", sunucu="yok")
        gizli = kesinti == "sonra"

        def ret(http, kod=None):
            if gizli:
                self.sonuc(i, "belirsiz", sunucu="ret")
            else:
                self.sonuc(i, "ret", http, kod)

        u = a.get("kullanici") or "Y"
        if mob:
            c = self.cih.get(a["cihaz"])
            if not self.lisans or c is None or not c["on"] or not self.kul[c["u"]]["uzak"]:
                return ret("4xx")
            u = c["u"]
        rol = self.kul[u]["rol"]
        s = a["sirket"]
        isr = self.kul[u]["sir"]
        if not (rol == "yonetici" or (s in isr if isr else s == "001")):
            return ret("4xx")
        S = self.sir[s]
        islem, yol = a["islem"], a.get("yol")
        if islem == "odeme" and yol in ("havale", "kart") and rol == "personel":
            return ret(403)
        if islem == "stok":
            m = a["miktar"]
        else:
            m = kahin.kurus(a["tutar"])
            if m is None:
                return ret(400)
        p = self.p
        if mob and ((a.get("fatura") and p["kapatilacak"] == "yalniz_fifo") or (yol in ("cek", "senet") and p["yollar"] == "nakit_havale_pos")
                    or (a.get("kart") and p["taksit"] == "yalniz_cari") or (islem == "stok" and a["yon"] == "cikis" and p["stok_yonu"] == "yalniz_giris")):
            return ret("4xx")
        sert = mob and p["onay"] == "gecemez"
        yine, bon, fazla = (a.get("yineDeKaydet") and not sert), (a.get("benzerOnay") and not sert), (a.get("fazlaAvans") and not sert)
        eksi_on = a.get("eksiOnay") and not (mob and p["eksi_stok"] == "gecemez")
        if mob and p["tarih"] == "sunucu_gunu":
            gonder, tarih = None, self.gun()
        else:
            gonder = a.get("tarih") or form.date().isoformat()
            tarih = gonder
        if tarih > self.gun():
            return ret(400)
        hesap = None
        if yol in ("havale", "pos", "kart"):
            tur = {"havale": "banka", "pos": "pos", "kart": "kart"}[yol]
            if a.get("hesap"):
                if a["hesap"] not in S["hes"]:
                    return ret([400, 404])
                if S["hes"][a["hesap"]] != tur:
                    return ret(400, "bank-account-invalid")
                hesap = a["hesap"]
            else:
                uy = [h for h, t in S["hes"].items() if t == tur]
                if len(uy) > 1:
                    return ret(400, "bank-account-required")
                hesap = uy[0] if uy else None
        anahtar = (s, u, islem + (":kart" if a.get("kart") else ""), a["istekKimligi"])
        govde = json.dumps([a.get("cari"), a.get("tutar"), a.get("miktar"), yol, a.get("hesap"), a.get("fatura"), a.get("kart"), bool(fazla), a.get("urun"),
                            a.get("yon"), gonder, s], ensure_ascii=False)
        if anahtar in self.ist:
            g, z = self.ist[anahtar]
            if self.simdi - z > timedelta(days=30):
                raise RuntimeError("üretici 30 günü aşan yeniden gönderim kurmamalı")
            if g == govde:
                if gizli:
                    self.sonuc(i, "belirsiz", sunucu="yineleme")
                else:
                    self.sonuc(i, "yineleme")
                return
            return ret(409)
        if islem != "stok":
            c = a["cari"]
            if c not in S["cari"]:
                return ret([403, 404] if any(c in x["cari"] for x in self.sir.values()) else 404)
            if a.get("fatura"):
                F = S["fat"].get(a["fatura"])
                if F is None or F["cari"] != c:
                    return ret(404)
                if F["tur"] != ("satis" if islem == "tahsilat" else "alis"):
                    return ret(409)
            if a.get("kart"):
                K = S["kart"].get(a["kart"])
                if K is None or K["cari"] != c:
                    return ret(404)
                kalan = K["top"] - sum(x for _, x in K["od"])
                if kalan <= 0:
                    return ret(409, "plan-paid")
                if m > kalan:
                    if not fazla:
                        return ret(409, "plan-overpay")
                    if rol == "personel":
                        return ret(403, "plan-overpay-permission")
        bk = None
        if islem != "stok" and hesap is not None:
            bk = (islem, yol, hesap, a["cari"], m, tarih, a.get("fatura") or (("kart:" + a["kart"]) if a.get("kart") else ""))
            if bk in S["benzer"] and not bon:
                return ret(409, "bank-similar")
        if islem == "odeme" and yol == "nakit":
            sat = S["kasa"] + [(tarih, -m)]
            if min(sum(x for t, x in sat if t <= tarih), sum(x for _, x in sat)) < 0:
                if S["eksi"] == "engelle":
                    return ret(409, "cash-blocked")
                if S["eksi"] == "uyar" and not yine:
                    return ret(409, "cash-negative")
        if islem == "stok":
            if a["yon"] == "cikis" and sum(S["urun"][a["urun"]]) - m < 0 and not eksi_on:
                return ret("4xx")
            S["urun"][a["urun"]].append(m if a["yon"] == "giris" else -m)
        else:
            yon = 1 if islem == "tahsilat" else -1
            if yol == "nakit":
                S["kasa"].append((tarih, yon * m))
            elif yol in ("cek", "senet"):
                S["port"] += m
                S["evr"] += 1
            elif hesap:
                S["hesap"][hesap] += yon * m
            else:
                h = "102.00" if yol == "havale" else "108.00"
                S["hesapsiz"][h] = S["hesapsiz"].get(h, 0) + yon * m
            if a.get("kart"):
                S["kart"][a["kart"]]["od"].append((i, m))
            S["kay"].append({"islem": islem, "cari": a["cari"], "m": m, "yol": yol, "fatura": a.get("fatura"), "kart": a.get("kart")})
            if bk:
                S["benzer"].add(bk)
        self.ist[anahtar] = (govde, self.simdi)
        if gizli:
            self.sonuc(i, "belirsiz", sunucu="ok")
        else:
            self.sonuc(i, "ok")

    def _kontrol(self, a):
        k = a["id"]
        for s in sorted(self.sir):
            S = self.sir[s]
            p = "%s:%s:" % (k, s)
            kartli = {x["cari"] for x in S["kart"].values()}
            for c in S["sira"]:
                C = S["cari"][c]
                kay = [x for x in S["kay"] if x["cari"] == c]
                bak = C["acilis"]
                bak += sum(f["tutar"] for f in S["fat"].values() if f["cari"] == c and f["tur"] == "satis")
                bak -= sum(f["tutar"] for f in S["fat"].values() if f["cari"] == c and f["tur"] == "alis")
                bak -= sum(x["m"] for x in kay if x["islem"] == "tahsilat")
                bak += sum(x["m"] for x in kay if x["islem"] == "odeme")
                self.out[p + "cari:%s:bakiye" % c] = bak
                self.out[p + "cari:%s:hareketSayisi" % c] = sum(1 for x in kay if not x["kart"] and x["yol"] not in ("cek", "senet"))
                if c in kartli:
                    continue
                for taraf, tur in (("tahsilat", "satis"), ("odeme", "alis")):
                    kalem = sorted((f["tarih"], f["n"], ad, f["tutar"]) for ad, f in S["fat"].items() if f["cari"] == c and f["tur"] == tur)
                    if tur == "satis" and C["acilis"]:
                        kalem.append((C["tarih"], C["n"], "@acilis", C["acilis"]))
                        kalem.sort()
                    bagli = {}
                    havuz = 0
                    for x in kay:
                        if x["islem"] != taraf:
                            continue
                        if x["fatura"]:
                            bagli[x["fatura"]] = bagli.get(x["fatura"], 0) + x["m"]
                        else:
                            havuz += x["m"]
                    acik = {}
                    for _, _, ad, t in kalem:
                        b = bagli.get(ad, 0)
                        acik[ad] = max(0, t - b)
                        havuz += max(0, b - t)
                    for _, _, ad, t in kalem:
                        d = min(acik[ad], havuz)
                        acik[ad] -= d
                        havuz -= d
                    for ad, v in acik.items():
                        if ad == "@acilis":
                            self.out[p + "acilis:%s:kalan" % c] = v
                        else:
                            self.out[p + "fatura:%s:acik" % ad] = v
            for kad in sorted(S["kart"]):
                K = S["kart"][kad]
                ham = sum(x for _, x in K["od"])
                od = min(ham, K["top"])
                self.out[p + "kart:%s:odenen" % kad] = od
                self.out[p + "kart:%s:fazla" % kad] = ham - od
                self.out[p + "kart:%s:kalan" % kad] = K["top"] - od
                self.out[p + "kart:%s:tahsilatSayisi" % kad] = len(K["od"])
                kal = od
                for j, t in enumerate(K["tk"]):
                    self.out[p + "kart:%s:taksit%d:odenen" % (kad, j + 1)] = min(t, kal)
                    kal -= min(t, kal)
            self.out[p + "kasa"] = sum(x for _, x in S["kasa"])
            gunler = {}
            for t, x in S["kasa"]:
                gunler[t] = gunler.get(t, 0) + x
            for t, v in gunler.items():
                if v:
                    self.out[p + "kasaGun:%s" % t] = v
            for h, tur in S["hes"].items():
                self.out[p + "%s:%s" % ({"banka": "banka", "pos": "pos", "kart": "kartHesap"}[tur], h)] = S["hesap"][h]
            for h, v in S["hesapsiz"].items():
                if v:
                    self.out[p + "hesapsiz:%s" % h] = v
            self.out[p + "portfoy"] = S["port"]
            self.out[p + "evrakSayisi"] = S["evr"]
            for u, h in S["urun"].items():
                self.out[p + "stok:%s:miktar" % u] = sum(h)
                self.out[p + "stok:%s:hareketSayisi" % u] = len(h)


def rastgele_birlesimleri():
    """Rastgele senaryoların 10 birleşimi: öneri, her parametre tek tek ters, hepsi ters."""
    out = [dict(kahin.ONERI)]
    for k, v in P.items():
        out.append(dict(kahin.ONERI, **{k: v[1] if kahin.ONERI[k] == v[0] else v[0]}))
    out.append({k: (v[1] if kahin.ONERI[k] == v[0] else v[0]) for k, v in P.items()})
    return out


def rastgele(tohum, olay=1500):
    return Uretici(tohum, olay).uret()


def akis_beklenen(senaryo, p):
    return {"beklenen": Akis(senaryo, p).kos(), "alternatifler": [], "etiket": "akış"}


# ═════════════════════════════════════════════════ kabul kümesi
RASTGELE_TOHUM = (1, 2, 3)
RASTGELE_OLAY = 1200
KABUL_YOL = os.path.join(_BURASI, "kabul.json")


def _sha256(yol):
    import hashlib
    with open(yol, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


def goreli_denetle(g):
    """Göreli çiftin iki yanı yalnız kanal/cihaz/kullanıcı alanlarında ayrışır ve kâhin onları HESAPLAMAZ (B hücresi → SenaryoHatasi)."""
    out = []
    m, d = g["mobil"]["adimlar"], g["masaustu"]["adimlar"]
    if len(m) != len(d):
        out.append("%s: adım sayısı farklı" % g["ad"])
    for x, y in zip(m, d):
        xa = {k: v for k, v in x.items() if k not in ("kanal", "cihaz", "kullanici")}
        ya = {k: v for k, v in y.items() if k not in ("kanal", "cihaz", "kullanici")}
        if xa != ya:
            out.append("%s: %s adımı kanal dışında da farklı" % (g["ad"], x["id"]))
    for kanal in ("masaustu", "mobil"):
        try:
            kahin.Kahin(g[kanal], dict(kahin.ONERI, **g["kosul"])).kos()
            out.append("%s-%s: kâhin hesapladı (B hücresi bekleniyordu)" % (g["ad"], kanal))
        except kahin.SenaryoHatasi as e:
            if "B" not in str(e):
                out.append("%s-%s: beklenmeyen hata %s" % (g["ad"], kanal, e))
    return out


def kabul_uret(olay=RASTGELE_OLAY, yaz=True, gunluk=print):
    hatalar = []
    kayitlar = []
    for k in ELLE:
        farklar, sonuclar = elle_denetle(k)
        if farklar:
            hatalar.append("ELLE %s: %d birleşimde model ≠ elle; ilk: %s" % (k["ad"], len(farklar), farklar[0][:900]))
            continue
        ilgili = ilgili_parametreler(sonuclar)
        kayitlar.append({"ad": k["ad"], "tur": "uc", "tohum": None, "aciklama": k["aciklama"], "kurallar": k["kurallar"], "kanal": k["kanal"],
                         "cift": k["cift"], "olay_sayisi": len(k["senaryo"]["adimlar"]), "ilgili": ilgili, "senaryo": k["senaryo"],
                         "gruplar": gruplar(sonuclar, ilgili)})
    gunluk("# elle: %d senaryo × %d birleşim denetlendi" % (len(ELLE), 2 ** len(P)))
    for g in GORELI:
        hatalar.extend("GÖRELİ " + x for x in goreli_denetle(g))
    for t in RASTGELE_TOHUM:
        sen = rastgele(t, olay)
        tab = None
        farkg = []
        for p in rastgele_birlesimleri():
            m = model_kos(sen, p)
            b = akis_beklenen(sen, p)
            f = esit(m, b)
            if f:
                hatalar.append("RASTGELE tohum %d [%s]: model ≠ akış beklentisi (%d); ilk: %s" % (t, kahin.birlesim_adi(p), len(f), " | ".join(f[:5])))
                continue
            if tab is None:
                tab = m["beklenen"]
            else:
                fark = {kk: m["beklenen"].get(kk, YOK) for kk in sorted(set(tab) | set(m["beklenen"])) if tab.get(kk, YOK) != m["beklenen"].get(kk, YOK)}
                farkg.append({"secim": dict(p), "fark": fark, "alternatifler": []})
        gunluk("# rastgele tohum %d: %d olay (adım), 10 birleşim: model = akış beklentisi" % (t, len(sen["adimlar"])))
        kayitlar.append({"ad": sen["ad"], "tur": "rastgele", "tohum": t, "aciklama": sen["aciklama"], "kurallar": ["bütün kurallar (README)"], "kanal": None,
                         "cift": None, "olay_sayisi": len(sen["adimlar"]), "ilgili": list(P), "senaryo": sen,
                         "gruplar": [{"secim": dict(kahin.ONERI), "beklenen": tab or {}, "alternatifler": []}], "fark_gruplar": farkg})
    kabul = {
        "surum": 1, "dil": kahin.DIL,
        "aciklama": "DestekOfis 2.4.7 M5 mobil yazma (tahsilat / ödeme / stok) bağımsız kâhininin kabul kümesi. Programın kodu görülmeden karar metninden üretildi; "
                    "para anlamı cari kâhinine (test/bagimsiz/cari/model.py, kural 2.4.6) devredilir. Kurallar, açık sorular, eşleme: README.md.",
        "kaynak": ["CLAUDE.md Açık iş: MOBİL kararları (26.10.2026), Kalıcı ürün kararları, dersler 5/7/10/13/17/22/31/32/40/43",
                   "docs/erp/OTURUM-DEVIR-TESLIM-2.4.7.md §3.1", "docs/2.4.7-IS-LISTESI.md Nasıl bozulur?", "docs/PRO-UZAKTAN-GORUNTULEME.md (eşleme / izin / lisans)",
                   "docs/BANKA-MODULU-PLAN.md §2.5, §3.5, §3.9, §3.10, §9", "test/bagimsiz/SENARYO-DILI.md §5", "test/bagimsiz/cari/ (model.py, KARARLAR.md)",
                   "MEVCUT ÜRÜN (ana oturum koddan doğruladı): şirket yetkisi kullanıcı × şirket; yönetici hepsi; işaretsiz yalnız 001; roller her şirkette aynı"],
        "uretim": "python3 -I test/bagimsiz/mobil-yazma/senaryolar.py (rastgele tohum %s, %d olay)" % ("–".join(map(str, (RASTGELE_TOHUM[0], RASTGELE_TOHUM[-1]))), olay),
        "cari_model_sha256": _sha256(kahin._CARI_YOL),
        "parametreler": {k: list(v) for k, v in P.items()}, "oneri": kahin.ONERI, "taban_birlesim": ILK, "esdeger_birlesim": ESDEGER,
        "birlesim_bicimi": "kapatilacak=…;yollar=…;taksit=…;onay=…;eksi_stok=…;tarih=…;gec_yeniden=…;stok_yonu=… (bu sırayla)",
        "secilen_birlesim": "kapatilacak=yalniz_fifo;yollar=nakit_havale_pos;taksit=kart_secilir;onay=sorar;eksi_stok=sorar;tarih=sunucu_gunu;gec_yeniden=telefon_24s;stok_yonu=yalniz_giris",
        "secim_notu": "Kullanıcı kararı S1–S8 (docs/2.4.7-IS-LISTESI.md 'KARARLAR — M5 mobil yazma', 29.10.2026; 5 dk yetkisiyle uygulandı): öneri birleşimi seçildi. Beklentiler değişmedi; yalnız seçim alanı.",
        "senaryolar": kayitlar,
        "goreli_ciftler": [{"ad": g["ad"], "aciklama": g["aciklama"], "kosul": g["kosul"], "masaustu": g["masaustu"], "mobil": g["mobil"]} for g in GORELI],
    }
    if hatalar:
        return kabul, hatalar
    if yaz:
        with open(KABUL_YOL, "w", encoding="utf-8") as f:
            f.write(kabul_metni(kabul))
    return kabul, []


def kabul_metni(obj):
    """Okunur ve küçük JSON: adım listeleri adım başına tek satır; geri kalan bir boşluk girintili, anahtarlar sıralı."""
    def yaz(x, g):
        ic = " " * (g + 1)
        if isinstance(x, list) and x and all(isinstance(e, dict) and "islem" in e for e in x):
            return "[\n" + ",\n".join(ic + json.dumps(e, ensure_ascii=False, sort_keys=True) for e in x) + "\n" + " " * g + "]"
        if isinstance(x, dict) and x:
            return "{\n" + ",\n".join(ic + json.dumps(k, ensure_ascii=False) + ": " + yaz(x[k], g + 1) for k in sorted(x)) + "\n" + " " * g + "}"
        if isinstance(x, list) and x and any(isinstance(e, (dict, list)) for e in x):
            return "[\n" + ",\n".join(ic + yaz(e, g + 1) for e in x) + "\n" + " " * g + "]"
        return json.dumps(x, ensure_ascii=False, sort_keys=True)
    return yaz(obj, 0) + "\n"


def main(argv):
    if "--senaryo" in argv:
        ad = argv[argv.index("--senaryo") + 1]
        for k in ELLE:
            if k["ad"] == ad:
                sys.stdout.write(json.dumps(k["senaryo"], ensure_ascii=False, indent=1, sort_keys=True) + "\n")
                return 0
        for t in RASTGELE_TOHUM:
            s = rastgele(t, RASTGELE_OLAY)
            if s["ad"] == ad:
                sys.stdout.write(json.dumps(s, ensure_ascii=False, indent=1, sort_keys=True) + "\n")
                return 0
        sys.stderr.write("senaryo yok: %s\n" % ad)
        return 1
    olay = int(argv[argv.index("--olay") + 1]) if "--olay" in argv else RASTGELE_OLAY
    yaz = "--denetle" not in argv and olay == RASTGELE_OLAY
    _, hatalar = kabul_uret(olay, yaz=yaz)
    if hatalar:
        for h in hatalar:
            print("HATA " + h)
        print("# kabul.json YAZILMADI: %d hata (model ≠ elle / akış beklentisi)" % len(hatalar))
        return 1
    print("# kabul.json %s" % ("yazıldı" if yaz else "yazılmadı (yalnız denetim)"))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
