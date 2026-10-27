#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""EDM gönderim sayacı kâhini — senaryolar ve kabul.json üreticisi.

İki tür senaryo:
  * UÇ (U01…): elle yazılmış olaylar + ELLE YAZILMIŞ beklenen sayılar (parametreye bağlıysa her seçenek için ayrı). Beklenen değer
    modelden türetilmez; model bu değerlere karşı denetlenir (kahin_test.py).
  * RASTGELE (R1–R3, tohum 1–3): belge başına "akış" (kabul, red → yeniden deneme, belirsiz → kesinleşme …) üretilir; üretici her
    akışın sayılıp sayılmadığını ve hangi anda kabul edildiğini AKIŞTAN bilir (modelden ayrı ikinci hesap). Tohum 1 kronolojik,
    tohum 2 ve 3 karışık sırayla yazılır.

`python3 -I senaryolar.py` kabul.json'u yeniden yazar; uç/üretici beklentisi modelle bir tek birleşimde bile ayrışırsa YAZMAZ, çıkış 1.
`--belge N` rastgele senaryo başına belge sayısı (varsayılan 500; kabul.json 500 ile üretilir, daha büyüğü yalnız ek denetim içindir).
"""
import importlib.util
import json
import os
import random
import sys
import uuid
from datetime import datetime, timedelta, timezone

sys.dont_write_bytecode = True  # depoya __pycache__ düşmesin
_BURASI = os.path.dirname(os.path.abspath(__file__))


def _yukle(ad):
    spec = importlib.util.spec_from_file_location(ad, os.path.join(_BURASI, f"{ad}.py"))
    modul = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modul)
    return modul


kahin = _yukle("kahin")
TR = timezone(timedelta(hours=3))
KABUL_YOLU = os.path.join(_BURASI, "kabul.json")
VARSAYILAN_BELGE = 500


# ---- yardımcılar ---------------------------------------------------------------------------------------------------
def E(n):
    """Okunur, geçerli biçimli ETTN (UUID)."""
    return f"00000000-0000-4000-8000-{n:012d}"


def t(metin):
    """'2026-10-31 23:59:59' → '2026-10-31T23:59:59+03:00' (TR yerel saat)."""
    return metin.replace(" ", "T") + "+03:00"


def ol(olay, ettn, zaman, sirket="001", ortam="live", tur="efatura", **ek):
    o = {"sirket": sirket, "ortam": ortam, "tur": tur, "ettn": ettn, "olay": olay, "zaman": zaman}
    o.update(ek)
    return o


def bakim(olay, sirket, zaman, **ek):
    o = {"sirket": sirket, "olay": olay, "zaman": zaman}
    o.update(ek)
    return o


def gecmis_belge(ettn, durum, zaman, sirket="001", ortam="live", tur="efatura"):
    """2.4.7 öncesinde (2.4.6) gönderilmiş/belirsiz kalmış belge — yalnız program sürücüsü içindir (K6: kâhin yok sayar)."""
    return {"sirket": sirket, "ortam": ortam, "tur": tur, "ettn": ettn, "durum": durum, "zaman": zaman, "surum": "2.4.6"}


def k(ay, ortam="live", tur="efatura"):
    return f"{ay}|{ortam}|{tur}"


UC = []


def uc(ad, aciklama, olaylar, el, referanslar=None, gecmis=None, acik_sorular=(), varsayimlar=(), kurallar=(), yapay=False):
    UC.append({
        "ad": ad, "tur": "uc", "aciklama": aciklama, "kurallar": list(kurallar), "acik_sorular": list(acik_sorular),
        "varsayimlar": list(varsayimlar), "yapay": yapay, "gecmis": list(gecmis or []), "referanslar": list(referanslar or []),
        "olaylar": olaylar, "el": el,
    })


# ---- UÇ DURUMLAR (beklenen değerler ELLE) ---------------------------------------------------------------------------
uc("U01-tek-kabul", "Tek kabul; referans tam olay anında (dahil) ve bir saniye önce.",
   [ol("gonder_kabul", E(1), t("2026-10-15 10:00:00"))],
   lambda p: {"sayilar": {k("2026-10"): 1}, "usage": {
       t("2026-10-15 09:59:59"): ({"aylar": ["2026-08", "2026-09", "2026-10"], "aylik": {}} if p["pencere"] == "icinde_dahil"
                                  else {"aylar": ["2026-07", "2026-08", "2026-09"], "aylik": {}}),
       t("2026-10-15 10:00:00"): ({"aylar": ["2026-08", "2026-09", "2026-10"], "aylik": {k("2026-10"): 1}} if p["pencere"] == "icinde_dahil"
                                  else {"aylar": ["2026-07", "2026-08", "2026-09"], "aylik": {}}),
   }},
   referanslar=[t("2026-10-15 09:59:59"), t("2026-10-15 10:00:00")], kurallar=["K1", "V11"])

uc("U02-ay-sonu-23-59-ayin-1i-00-00", "Ay sonu 23:59:59 o aya, ayın 1'i 00:00:00 yeni aya yazılır.",
   [ol("gonder_kabul", E(1), t("2026-10-31 23:59:59"), tur="earsiv"),
    ol("gonder_kabul", E(2), t("2026-11-01 00:00:00"), tur="earsiv")],
   lambda p: {"sayilar": {k("2026-10", tur="earsiv"): 1, k("2026-11", tur="earsiv"): 1}, "usage": {
       t("2026-10-31 23:59:59"): ({"aylar": ["2026-08", "2026-09", "2026-10"], "aylik": {k("2026-10", tur="earsiv"): 1}}
                                  if p["pencere"] == "icinde_dahil" else {"aylar": ["2026-07", "2026-08", "2026-09"], "aylik": {}}),
       t("2026-11-01 00:00:00"): ({"aylar": ["2026-09", "2026-10", "2026-11"],
                                   "aylik": {k("2026-10", tur="earsiv"): 1, k("2026-11", tur="earsiv"): 1}}
                                  if p["pencere"] == "icinde_dahil"
                                  else {"aylar": ["2026-08", "2026-09", "2026-10"], "aylik": {k("2026-10", tur="earsiv"): 1}}),
   }},
   referanslar=[t("2026-10-31 23:59:59"), t("2026-11-01 00:00:00")], kurallar=["K1", "V1"])

uc("U03-utc-ve-ofsetsiz-saat", "Saat UTC (Z), +00:00 ya da ofsetsiz yazılsa da ay TR yerel saatine göre.",
   [ol("gonder_kabul", E(1), "2026-10-31T21:30:00Z", tur="esmm"),          # TR 01.11 00:30
    ol("gonder_kabul", E(2), "2026-11-30T23:59:59", tur="esmm"),           # ofsetsiz = TR
    ol("gonder_kabul", E(3), "2026-11-30T21:00:00+00:00", tur="esmm")],    # TR 01.12 00:00
   lambda p: {"sayilar": {k("2026-11", tur="esmm"): 2, k("2026-12", tur="esmm"): 1}}, kurallar=["V1"])

uc("U04-yil-donumu", "31.12 23:59:59 → Aralık, 01.01 00:00:00 → Ocak; aynı ay numarası başka yılda ayrı ay.",
   [ol("gonder_kabul", E(1), t("2026-12-31 23:59:59")),
    ol("gonder_kabul", E(2), t("2027-01-01 00:00:00")),
    ol("gonder_kabul", E(3), t("2028-01-10 12:00:00"))],
   lambda p: {"sayilar": {k("2026-12"): 1, k("2027-01"): 1, k("2028-01"): 1}, "usage": {
       t("2027-01-01 00:00:00"): ({"aylar": ["2026-11", "2026-12", "2027-01"], "aylik": {k("2026-12"): 1, k("2027-01"): 1}}
                                  if p["pencere"] == "icinde_dahil"
                                  else {"aylar": ["2026-10", "2026-11", "2026-12"], "aylik": {k("2026-12"): 1}}),
   }},
   referanslar=[t("2027-01-01 00:00:00"), t("2028-02-01 00:00:00")], kurallar=["V1"])

uc("U05-ayni-ettn-iki-sirkette", "Aynı ETTN iki şirkette kabul (veri kopyalanmış şirket). Metnin harfi: ETTN + ortam bir kez (S2).",
   [ol("gonder_kabul", E(1), t("2026-10-05 10:00:00"), sirket="001"),
    ol("gonder_kabul", E(1), t("2026-10-06 10:00:00"), sirket="002")],
   lambda p: {"sayilar": {k("2026-10"): 1 if p["anahtar"] == "ettn_ortam" else 2}},
   acik_sorular=["S2"], kurallar=["K3", "K7"])

uc("U06-ayni-ettn-test-ve-canlida", "Aynı ETTN test ve canlıda: iki ayrı sayı (K5).",
   [ol("gonder_kabul", E(1), t("2026-10-05 10:00:00"), ortam="test"),
    ol("gonder_kabul", E(1), t("2026-10-06 10:00:00"), ortam="live")],
   lambda p: {"sayilar": {k("2026-10", "test"): 1, k("2026-10", "live"): 1}}, kurallar=["K3", "K5"])

uc("U07-11048-ilk-olay", "2.4.6'da gönderilmiş belgeye 2.4.7'de ilk olay 11048: sayılmaz (K3, K6).",
   [ol("zaten_gonderilmis_11048", E(1), t("2026-10-05 10:00:00")),
    ol("durum_sorgusu", E(1), t("2026-10-06 10:00:00"))],
   lambda p: {"sayilar": {}},
   gecmis=[gecmis_belge(E(1), "kabul", t("2026-09-20 10:00:00"))], kurallar=["K3", "K6"])

uc("U08-iptal-sonrasi-yeniden-gonderim", "Kabul → iptal → aynı ETTN yeniden kabul: bir kez; yeni ETTN'li yeniden düzenleme ayrıca sayılır.",
   [ol("gonder_kabul", E(1), t("2026-10-10 10:00:00"), tur="earsiv"),
    ol("iptal", E(1), t("2026-10-12 10:00:00"), tur="earsiv"),
    ol("gonder_kabul", E(1), t("2026-11-02 10:00:00"), tur="earsiv"),
    ol("gonder_kabul", E(2), t("2026-11-02 10:05:00"), tur="earsiv")],
   lambda p: {"sayilar": {k("2026-10", tur="earsiv"): 1, k("2026-11", tur="earsiv"): 1}}, kurallar=["K2", "K3", "V3"])

uc("U09-red-sonrasi-ayni-ettn-kabul", "Red → yeniden deneme kabul (ay sınırı aşar) ve red ×2 → elle yeniden gönder kabul: ikisi de bir kez, kabul anının ayında.",
   [ol("gonder_red", E(1), t("2026-10-30 16:00:00"), profil="TICARI"),
    ol("yeniden_deneme_kabul", E(1), t("2026-11-02 09:00:00"), profil="TICARI"),
    ol("gonder_red", E(2), t("2026-10-20 10:00:00")),
    ol("gonder_red", E(2), t("2026-10-21 10:00:00")),
    ol("gonder_kabul", E(2), t("2026-10-22 10:00:00"))],
   lambda p: {"sayilar": {k("2026-10"): 1, k("2026-11"): 1}}, kurallar=["K1", "K3", "V2"])

uc("U10-sira-karisik", "Olaylar ters sırayla gelir; kâhin zamana göre sıralar (belirsiz → kesinleşme ay sınırında).",
   list(reversed([
       ol("gonder_kabul", E(2), t("2026-10-15 10:00:00"), tur="earsiv"),
       ol("iptal", E(2), t("2026-10-20 10:00:00"), tur="earsiv"),
       ol("durum_sorgusu", E(2), t("2026-10-21 10:00:00"), tur="earsiv"),
       ol("gonder_belirsiz", E(1), t("2026-10-31 23:50:00"), tur="earsiv"),
       ol("belirsiz_kesinlesti_kabul", E(1), t("2026-11-01 00:10:00"), tur="earsiv"),
       ol("gonder_red", E(3), t("2026-11-03 10:00:00"), tur="earsiv"),
       ol("yeniden_deneme_kabul", E(3), t("2026-11-04 10:00:00"), tur="earsiv"),
   ])),
   lambda p: {"sayilar": ({k("2026-10", tur="earsiv"): 1, k("2026-11", tur="earsiv"): 2} if p["ay"] == "kesinlesme"
                          else {k("2026-10", tur="earsiv"): 2, k("2026-11", tur="earsiv"): 1})},
   acik_sorular=["S1"], kurallar=["V8", "K4"])

uc("U11-belirsiz-kesinlesti-ayni-ay", "Belirsiz → durum sorgusu → kesinleşti kabul, aynı ay: bir kez.",
   [ol("gonder_belirsiz", E(1), t("2026-10-10 10:00:00")),
    ol("durum_sorgusu", E(1), t("2026-10-10 10:05:00")),
    ol("belirsiz_kesinlesti_kabul", E(1), t("2026-10-10 10:06:00"))],
   lambda p: {"sayilar": {k("2026-10"): 1}}, kurallar=["K4", "V4"])

uc("U12-belirsiz-ay-sinirinda-kesinlesti", "Belirsiz 31.10 23:58 → kabul kesinleşmesi 01.11 00:02: ay seçimi S1.",
   [ol("gonder_belirsiz", E(1), t("2026-10-31 23:58:00"), tur="earsiv"),
    ol("belirsiz_kesinlesti_kabul", E(1), t("2026-11-01 00:02:00"), tur="earsiv")],
   lambda p: {"sayilar": {k("2026-11" if p["ay"] == "kesinlesme" else "2026-10", tur="earsiv"): 1}, "usage": {
       t("2026-11-01 00:01:00"): ({"aylar": ["2026-09", "2026-10", "2026-11"], "aylik": {}} if p["pencere"] == "icinde_dahil"
                                  else {"aylar": ["2026-08", "2026-09", "2026-10"], "aylik": {}}),
       t("2026-11-05 12:00:00"): (
           {"aylar": ["2026-09", "2026-10", "2026-11"],
            "aylik": {k("2026-11" if p["ay"] == "kesinlesme" else "2026-10", tur="earsiv"): 1}}
           if p["pencere"] == "icinde_dahil" else
           {"aylar": ["2026-08", "2026-09", "2026-10"],
            "aylik": {} if p["ay"] == "kesinlesme" else {k("2026-10", tur="earsiv"): 1}}),
   }},
   referanslar=[t("2026-11-01 00:01:00"), t("2026-11-05 12:00:00")], acik_sorular=["S1", "S5"], kurallar=["K4", "V4"])

uc("U13-belirsiz-kesinlesti-red", "Belirsiz → kesinleşti red: sayılmaz.",
   [ol("gonder_belirsiz", E(1), t("2026-10-10 10:00:00")),
    ol("belirsiz_kesinlesti_red", E(1), t("2026-10-11 10:00:00"))],
   lambda p: {"sayilar": {}}, kurallar=["K1", "V4"])

uc("U14-belirsiz-sonucsuz", "Belirsiz kalır, üç durum sorgusu sonuç vermez: sayılmaz.",
   [ol("gonder_belirsiz", E(1), t("2026-10-10 10:00:00")),
    ol("durum_sorgusu", E(1), t("2026-10-10 11:00:00")),
    ol("durum_sorgusu", E(1), t("2026-10-11 11:00:00")),
    ol("durum_sorgusu", E(1), t("2026-10-12 11:00:00"))],
   lambda p: {"sayilar": {}}, kurallar=["K3", "V4"])

uc("U15-belirsiz-sonra-11048", "Belirsiz → yeniden gönderimde 11048 (kendi ETTN'i), ayrı kesinleşme olayı yok: S3.",
   [ol("gonder_belirsiz", E(1), t("2026-10-31 23:00:00")),
    ol("zaten_gonderilmis_11048", E(1), t("2026-11-01 09:00:00"))],
   lambda p: {"sayilar": ({} if p["e11048"] == "saymaz"
                          else {k("2026-11" if p["ay"] == "kesinlesme" else "2026-10"): 1})},
   acik_sorular=["S3", "S1"], kurallar=["K3", "K4"])

uc("U16-iki-belirsiz-sonra-kesinlesme", "Belirsiz 30.09 → belirsiz 01.10 → kesinleşme 02.11: gönderim anı = ilk belirsiz (V6).",
   [ol("gonder_belirsiz", E(1), t("2026-09-30 23:30:00")),
    ol("gonder_belirsiz", E(1), t("2026-10-01 08:00:00")),
    ol("belirsiz_kesinlesti_kabul", E(1), t("2026-11-02 10:00:00"))],
   lambda p: {"sayilar": {k("2026-11" if p["ay"] == "kesinlesme" else "2026-09"): 1}},
   acik_sorular=["S1"], varsayimlar=["V6"], kurallar=["K4"])

uc("U17-red-araya-girer", "Belirsiz → kesinleşti red → yeni belirsiz → kesinleşti kabul: gönderim anı = red'den sonraki belirsiz (V6).",
   [ol("gonder_belirsiz", E(1), t("2026-09-29 10:00:00")),
    ol("belirsiz_kesinlesti_red", E(1), t("2026-09-30 10:00:00")),
    ol("gonder_belirsiz", E(1), t("2026-10-02 10:00:00")),
    ol("belirsiz_kesinlesti_kabul", E(1), t("2026-11-01 10:00:00"))],
   lambda p: {"sayilar": {k("2026-11" if p["ay"] == "kesinlesme" else "2026-10"): 1}},
   acik_sorular=["S1"], varsayimlar=["V6"], kurallar=["K4"])

uc("U18-kabul-sonrasi-gurultu", "Kabul → yeniden deneme kabul → 11048 → durum → iptal (sonraki ay): bir kez, iptal düşürmez.",
   [ol("gonder_kabul", E(1), t("2026-10-05 10:00:00")),
    ol("yeniden_deneme_kabul", E(1), t("2026-10-06 10:00:00")),
    ol("zaten_gonderilmis_11048", E(1), t("2026-10-07 10:00:00")),
    ol("durum_sorgusu", E(1), t("2026-10-08 10:00:00")),
    ol("iptal", E(1), t("2026-11-09 10:00:00"))],
   lambda p: {"sayilar": {k("2026-10"): 1}}, kurallar=["K2", "K3", "V3"])

uc("U19-iki-kullanici-ayni-saniye", "İki kullanıcı aynı belgeyi aynı saniyede gönderir, ikisi de 'kabul' okur: bir kez.",
   [ol("gonder_kabul", E(1), t("2026-10-05 10:00:00")),
    ol("gonder_kabul", E(1), t("2026-10-05 10:00:00"))],
   lambda p: {"sayilar": {k("2026-10"): 1}}, kurallar=["K3", "V8"])

uc("U20-yetim-kesinlesme-eski-surum", "2.4.6'da belirsiz kalan belgeler 2.4.7'de kesinleşir / 11048 alır: sayılmaz (geriye dönük yok).",
   [ol("belirsiz_kesinlesti_kabul", E(1), t("2026-10-02 10:00:00")),
    ol("zaten_gonderilmis_11048", E(2), t("2026-10-03 10:00:00"))],
   lambda p: {"sayilar": {}},
   gecmis=[gecmis_belge(E(1), "belirsiz", t("2026-09-28 10:00:00")), gecmis_belge(E(2), "belirsiz", t("2026-09-29 10:00:00"))],
   varsayimlar=["V5"], kurallar=["K6"])

uc("U21-eski-surumde-kabul-edilmis", "2.4.6'da kabul edilmiş belgeye 11048, durum sorgusu, iptal: sayılmaz.",
   [ol("zaten_gonderilmis_11048", E(1), t("2026-10-01 10:00:00"), tur="earsiv"),
    ol("durum_sorgusu", E(1), t("2026-10-02 10:00:00"), tur="earsiv"),
    ol("iptal", E(1), t("2026-10-03 10:00:00"), tur="earsiv")],
   lambda p: {"sayilar": {}},
   gecmis=[gecmis_belge(E(1), "kabul", t("2026-09-10 10:00:00"), tur="earsiv")], kurallar=["K3", "K6"])

uc("U22-turler-ve-profiller", "e-Fatura TEMEL, TİCARİ ve profilsiz tek tür; e-Arşiv ve e-SMM ayrı.",
   [ol("gonder_kabul", E(1), t("2026-10-10 10:00:00"), profil="TEMEL"),
    ol("gonder_kabul", E(2), t("2026-10-11 10:00:00"), profil="TICARI"),
    ol("gonder_kabul", E(3), t("2026-10-12 10:00:00"), tur="earsiv"),
    ol("gonder_kabul", E(4), t("2026-10-13 10:00:00"), tur="esmm"),
    ol("gonder_kabul", E(5), t("2026-10-14 10:00:00"))],
   lambda p: {"sayilar": {k("2026-10"): 3, k("2026-10", tur="earsiv"): 1, k("2026-10", tur="esmm"): 1}}, kurallar=["K1", "V9"])

uc("U23-sirketler-toplanir", "Üç şirketin (3. eski kurulum) gönderimleri tek sayıda toplanır.",
   [ol("gonder_kabul", E(1), t("2026-10-01 10:00:00"), sirket="001", tur="earsiv"),
    ol("gonder_kabul", E(2), t("2026-10-02 10:00:00"), sirket="001", tur="earsiv"),
    ol("gonder_kabul", E(3), t("2026-10-03 10:00:00"), sirket="002", tur="earsiv"),
    ol("gonder_kabul", E(4), t("2026-10-04 10:00:00"), sirket="002", tur="earsiv"),
    ol("gonder_kabul", E(5), t("2026-10-05 10:00:00"), sirket="002", tur="earsiv"),
    ol("gonder_kabul", E(6), t("2026-10-06 10:00:00"), sirket="003", tur="earsiv")],
   lambda p: {"sayilar": {k("2026-10", tur="earsiv"): 6}}, kurallar=["K7"])

uc("U24-bos", "Boş olay listesi: sayı yok, usage pencere ayları sıfır.",
   [],
   lambda p: {"sayilar": {}, "usage": {
       t("2026-10-15 09:00:00"): ({"aylar": ["2026-08", "2026-09", "2026-10"], "aylik": {}} if p["pencere"] == "icinde_dahil"
                                  else {"aylar": ["2026-07", "2026-08", "2026-09"], "aylik": {}})}},
   referanslar=[t("2026-10-15 09:00:00")], kurallar=["V11"])

_U25 = {  # olay ayları: 07 ef, 08 ef, 09 ea (01.09 10:00), 09 ef, 10 ef, 10 test esmm, 11 ef (03.11)
    "icinde_R3": {"aylar": ["2026-08", "2026-09", "2026-10"],
                  "aylik": {k("2026-08"): 1, k("2026-09", tur="earsiv"): 1, k("2026-09"): 1, k("2026-10"): 1, k("2026-10", "test", "esmm"): 1}},
    "tamam_R3": {"aylar": ["2026-07", "2026-08", "2026-09"],
                 "aylik": {k("2026-07"): 1, k("2026-08"): 1, k("2026-09", tur="earsiv"): 1, k("2026-09"): 1}},
    "icinde_R2": {"aylar": ["2026-09", "2026-10", "2026-11"],
                  "aylik": {k("2026-09", tur="earsiv"): 1, k("2026-09"): 1, k("2026-10"): 1, k("2026-10", "test", "esmm"): 1}},
    "tamam_R2": {"aylar": ["2026-08", "2026-09", "2026-10"],
                 "aylik": {k("2026-08"): 1, k("2026-09", tur="earsiv"): 1, k("2026-09"): 1, k("2026-10"): 1, k("2026-10", "test", "esmm"): 1}},
    "icinde_R1": {"aylar": ["2026-09", "2026-10", "2026-11"],
                  "aylik": {k("2026-09", tur="earsiv"): 1, k("2026-09"): 1, k("2026-10"): 1, k("2026-10", "test", "esmm"): 1, k("2026-11"): 1}},
}
_U25["tamam_R1"] = _U25["tamam_R2"]
_U25["icinde_R4"], _U25["tamam_R4"] = _U25["icinde_R1"], _U25["tamam_R1"]
uc("U25-kullanim-penceresi", "B2 usage: ay sonu, ayın 1'i 00:00, ayın 5'i ve ay sonu öncesi referansla son 3 ay (S5); referanstan sonraki olay dahil değil.",
   [ol("gonder_kabul", E(1), t("2026-07-15 12:00:00")),
    ol("gonder_kabul", E(2), t("2026-08-15 12:00:00")),
    ol("gonder_kabul", E(3), t("2026-09-01 10:00:00"), tur="earsiv"),
    ol("gonder_kabul", E(4), t("2026-09-15 12:00:00")),
    ol("gonder_kabul", E(5), t("2026-10-15 12:00:00")),
    ol("gonder_kabul", E(6), t("2026-10-20 12:00:00"), ortam="test", tur="esmm"),
    ol("gonder_kabul", E(7), t("2026-11-03 12:00:00"))],
   lambda p: {"sayilar": {k("2026-07"): 1, k("2026-08"): 1, k("2026-09", tur="earsiv"): 1, k("2026-09"): 1, k("2026-10"): 1,
                          k("2026-10", "test", "esmm"): 1, k("2026-11"): 1},
              "usage": {r: _U25[("icinde_" if p["pencere"] == "icinde_dahil" else "tamam_") + ad]
                        for ad, r in (("R3", t("2026-10-31 23:59:59")), ("R2", t("2026-11-01 00:00:00")),
                                      ("R1", t("2026-11-05 10:00:00")), ("R4", t("2026-11-30 23:00:00")))}},
   referanslar=[t("2026-10-31 23:59:59"), t("2026-11-01 00:00:00"), t("2026-11-05 10:00:00"), t("2026-11-30 23:00:00")],
   acik_sorular=["S5"], kurallar=["K8", "V11", "V12"])


def _u27(p, ref):
    kes = p["ay"] == "kesinlesme"
    icinde = p["pencere"] == "icinde_dahil"
    if ref == "R0":  # 15.10 00:00: hiçbir kesinleşme bilinmiyor
        return {"aylar": ["2026-08", "2026-09", "2026-10"] if icinde else ["2026-07", "2026-08", "2026-09"], "aylik": {}}
    if ref in ("Rtam", "R5"):  # 02.11 10:00 (E1'in kesinleşme anı, dahil) ve 05.11: yalnız E1 bilinir
        if icinde:
            return {"aylar": ["2026-09", "2026-10", "2026-11"], "aylik": {k("2026-11"): 1} if kes else {}}
        return {"aylar": ["2026-08", "2026-09", "2026-10"], "aylik": {} if kes else {k("2026-08"): 1}}
    # R10 10.11: E1 ve E2 bilinir
    if icinde:
        return {"aylar": ["2026-09", "2026-10", "2026-11"], "aylik": {k("2026-11"): 2} if kes else {k("2026-10"): 1}}
    return {"aylar": ["2026-08", "2026-09", "2026-10"], "aylik": {} if kes else {k("2026-08"): 1, k("2026-10"): 1}}


_U27_REF = (("R0", t("2026-10-15 00:00:00")), ("Rtam", t("2026-11-02 10:00:00")), ("R5", t("2026-11-05 10:00:00")),
            ("R10", t("2026-11-10 10:00:00")))
uc("U27-kesinlesme-pencere-disi", "Belirsiz 31.08 → kesinleşme 02.11; belirsiz 20.10 → kesinleşme 07.11. 'gönderim' seçeneğinde Ağustos 3 aylık pencerenin dışında kalır; referanstaki bilgi kadar.",
   [ol("gonder_belirsiz", E(1), t("2026-08-31 22:00:00")),
    ol("belirsiz_kesinlesti_kabul", E(1), t("2026-11-02 10:00:00")),
    ol("gonder_belirsiz", E(2), t("2026-10-20 10:00:00")),
    ol("belirsiz_kesinlesti_kabul", E(2), t("2026-11-07 10:00:00"))],
   lambda p: {"sayilar": ({k("2026-11"): 2} if p["ay"] == "kesinlesme" else {k("2026-08"): 1, k("2026-10"): 1}),
              "usage": {r: _u27(p, ad) for ad, r in _U27_REF}},
   referanslar=[r for _, r in _U27_REF], acik_sorular=["S1", "S5"], kurallar=["K4", "K8", "V11"])

def _u28(p, ref):
    etk = p["geri_yukleme"] == "etkilemez"
    icinde = p["pencere"] == "icinde_dahil"
    if ref == "Ra" or etk:  # geri yüklemeden önce ya da sayaç etkilenmiyorsa: E2 (09) + E1, E3 (10)
        aylik_i = {k("2026-09", tur="earsiv"): 1, k("2026-10", tur="earsiv"): 2}
        aylik_t = {k("2026-09", tur="earsiv"): 1}
    else:  # geri_alir: 001'in yedekten (25.09 18:00) sonraki kayıtları (E2 28.09, E1 05.10) unutulur; E3 (002) kalır
        aylik_i = {k("2026-10", tur="earsiv"): 1}
        aylik_t = {}
    if icinde:
        return {"aylar": ["2026-08", "2026-09", "2026-10"], "aylik": aylik_i}
    return {"aylar": ["2026-07", "2026-08", "2026-09"], "aylik": aylik_t}


_U28_REF = (("Ra", t("2026-10-05 12:00:00")), ("Rc", t("2026-10-06 09:00:00")), ("Rb", t("2026-10-10 12:00:00")))  # Rc = geri yükleme anı (dahil)
uc("U28-yedekten-geri-yukleme", "Yedek tatbikatı: 001 yedeği 25.09 18:00; 28.09 ve 05.10'da kabul; 06.10'da geri yükleme; iki belge yeniden gönderilir → EDM 11048. 002'ye dokunulmaz (S4).",
   [ol("gonder_kabul", E(2), t("2026-09-28 10:00:00"), tur="earsiv"),
    ol("gonder_kabul", E(1), t("2026-10-05 10:00:00"), tur="earsiv"),
    ol("gonder_kabul", E(3), t("2026-10-05 11:00:00"), sirket="002", tur="earsiv"),
    bakim("yedekten_geri_yuklendi", "001", t("2026-10-06 09:00:00"), yedek_zamani=t("2026-09-25 18:00:00")),
    ol("zaten_gonderilmis_11048", E(1), t("2026-10-07 10:00:00"), tur="earsiv"),
    ol("zaten_gonderilmis_11048", E(2), t("2026-10-08 10:00:00"), tur="earsiv")],
   lambda p: {"sayilar": ({k("2026-09", tur="earsiv"): 1, k("2026-10", tur="earsiv"): 2} if p["geri_yukleme"] == "etkilemez"
                          else {k("2026-10", tur="earsiv"): 1}),
              "usage": {r: _u28(p, ad) for ad, r in _U28_REF}},
   referanslar=[r for _, r in _U28_REF], acik_sorular=["S4", "S5"], kurallar=["K2"])

uc("U29-sirket-verisi-sifirlandi", "001'in verisi sıfırlanır (önce iki kabul, sonra bir kabul); 002 etkilenmez (S4).",
   [ol("gonder_kabul", E(1), t("2026-10-03 10:00:00"), tur="earsiv"),
    ol("gonder_kabul", E(2), t("2026-10-04 10:00:00"), tur="earsiv"),
    ol("gonder_kabul", E(4), t("2026-10-10 10:00:00"), sirket="002", tur="earsiv"),
    bakim("sirket_sifirlandi", "001", t("2026-10-20 10:00:00")),
    ol("gonder_kabul", E(3), t("2026-10-25 10:00:00"), tur="earsiv")],
   lambda p: {"sayilar": {k("2026-10", tur="earsiv"): 4 if p["geri_yukleme"] == "etkilemez" else 2}},
   acik_sorular=["S4"], kurallar=["K2", "K7"])

uc("U30-belge-silindi-yeniden-acildi", "Kabul edilen belge listeden silinir, aynı içerikle yeni belge (yeni ETTN) kesilir: ikisi de sayılır, silme düşürmez.",
   [ol("gonder_kabul", E(1), t("2026-10-05 10:00:00")),
    ol("belge_silindi", E(1), t("2026-10-06 10:00:00")),
    ol("gonder_kabul", E(2), t("2026-10-07 10:00:00"))],
   lambda p: {"sayilar": {k("2026-10"): 2}}, kurallar=["K2"])

uc("U31-ettn-buyuk-kucuk-harf", "Aynı ETTN büyük harfle ve küçük harfle: bir kez (V7, varsayım).",
   [ol("gonder_kabul", "ABCDEF01-2345-4678-9ABC-DEF012345678", t("2026-10-05 10:00:00")),
    ol("yeniden_deneme_kabul", " abcdef01-2345-4678-9abc-def012345678 ", t("2026-10-06 10:00:00"))],
   lambda p: {"sayilar": {k("2026-10"): 1}}, varsayimlar=["V7"], kurallar=["K3"])

uc("U32-cok-gurultu", "Bir kabulün ardından 30 durum sorgusu, 10 iptal, 10 kez 11048, 5 silme: bir kez.",
   [ol("gonder_kabul", E(1), t("2026-10-01 10:00:00"))]
   + [ol("durum_sorgusu", E(1), t(f"2026-10-{2 + i % 27:02d} {8 + i % 10:02d}:00:00")) for i in range(30)]
   + [ol("iptal", E(1), t(f"2026-11-{1 + i:02d} 10:00:00")) for i in range(10)]
   + [ol("zaten_gonderilmis_11048", E(1), t(f"2026-11-{12 + i:02d} 10:00:00")) for i in range(10)]
   + [ol("belge_silindi", E(1), t(f"2026-12-{1 + i:02d} 10:00:00")) for i in range(5)],
   lambda p: {"sayilar": {k("2026-10"): 1}}, kurallar=["K2", "K3"])

uc("U33-belirsiz-sonra-yeniden-deneme-kabul", "Belirsiz 31.10 → yeniden deneme 01.11'de kabul: kabul eden istek yeniden deneme, ay Kasım (V2).",
   [ol("gonder_belirsiz", E(1), t("2026-10-31 23:00:00")),
    ol("yeniden_deneme_kabul", E(1), t("2026-11-01 08:00:00"))],
   lambda p: {"sayilar": {k("2026-11"): 1}}, varsayimlar=["V2"], kurallar=["K3"])

uc("U34-ortam-degisti-kesinlesme", "Test'te belirsiz kalan belge, ayar Canlı'ya alındıktan sonra canlıda 'kesinleşmiş' görünür: sayılmaz (K5, V5).",
   [ol("gonder_belirsiz", E(1), t("2026-10-05 10:00:00"), ortam="test"),
    ol("belirsiz_kesinlesti_kabul", E(1), t("2026-10-06 10:00:00"), ortam="live")],
   lambda p: {"sayilar": {}}, varsayimlar=["V5"], kurallar=["K5"])

uc("U35-sirket-capraz-kesinlesme", "001'de belirsiz, aynı ETTN 002'de kesinleşir (yapay; anahtar sorusu S2 yetim kuralına da dokunur).",
   [ol("gonder_belirsiz", E(1), t("2026-10-05 10:00:00"), sirket="001"),
    ol("belirsiz_kesinlesti_kabul", E(1), t("2026-10-06 10:00:00"), sirket="002")],
   lambda p: {"sayilar": {k("2026-10"): 1} if p["anahtar"] == "ettn_ortam" else {}},
   acik_sorular=["S2"], varsayimlar=["V5"], kurallar=["K3"], yapay=True)

uc("U36-yalniz-iptal", "Hiç gönderilmemiş belgede (Yalnız Programda İptal) iptal: sayılmaz.",
   [ol("iptal", E(1), t("2026-10-05 10:00:00"), tur="earsiv")],
   lambda p: {"sayilar": {}}, kurallar=["K3"])

uc("U37-artik-yil-subat", "29.02.2028 23:59:59 → Şubat, 01.03.2028 00:00:00 → Mart.",
   [ol("gonder_kabul", E(1), t("2028-02-29 23:59:59"), ortam="test", tur="esmm"),
    ol("gonder_kabul", E(2), t("2028-03-01 00:00:00"), ortam="test", tur="esmm")],
   lambda p: {"sayilar": {k("2028-02", "test", "esmm"): 1, k("2028-03", "test", "esmm"): 1}}, kurallar=["V1"])

uc("U38-11048-sonra-kesinlesme", "Belirsiz 30.10 → 11048 31.10 23:30 → kesinleşti 01.11: S3 ve S1 birlikte.",
   [ol("gonder_belirsiz", E(1), t("2026-10-30 10:00:00")),
    ol("zaten_gonderilmis_11048", E(1), t("2026-10-31 23:30:00")),
    ol("belirsiz_kesinlesti_kabul", E(1), t("2026-11-01 09:00:00"))],
   lambda p: {"sayilar": {k("2026-11" if (p["ay"] == "kesinlesme" and p["e11048"] == "saymaz") else "2026-10"): 1}},
   acik_sorular=["S1", "S3"], kurallar=["K3", "K4"])

uc("U39-tekrarlanan-red", "Üç kez red: sayılmaz.",
   [ol("gonder_red", E(1), t("2026-10-01 10:00:00"), tur="esmm"),
    ol("gonder_red", E(1), t("2026-10-02 10:00:00"), tur="esmm"),
    ol("gonder_red", E(1), t("2026-10-03 10:00:00"), tur="esmm")],
   lambda p: {"sayilar": {}}, kurallar=["K1"])

uc("U40-belirsiz-red-sonra-kesinlesme", "F2: belirsiz 30.09 → yeniden gönderim red 01.10 → durum sorgusu kabul 02.10: SAYILIR, ay ilk açık iz (30.09).",
   [ol("gonder_belirsiz", E(1), t("2026-09-30 22:00:00")),
    ol("gonder_red", E(1), t("2026-10-01 10:00:00")),
    ol("belirsiz_kesinlesti_kabul", E(1), t("2026-10-02 10:00:00"))],
   lambda p: {"sayilar": {k("2026-10" if p["ay"] == "kesinlesme" else "2026-09"): 1}},
   acik_sorular=["S1"], kurallar=["K4", "K11"])

# ---- 27.10.2026 kararları: F1, F2, sayaç defteri yedekte (K10–K12) ----------------------------------------------------
uc("U41-F1-bulunamadi-yeniden-belirsiz-kesinlesme",
   "F1: belirsiz 31.10 → EDM 'bulunamadı' 01.11 → yeniden gönderim yine belirsiz 01.11 → kabul kesinleşir 01.12: ay = 'bulunamadı'dan SONRAKİ gönderim (Kasım).",
   [ol("gonder_belirsiz", E(1), t("2026-10-31 23:00:00"), profil="TICARI"),
    ol("durum_bulunamadi", E(1), t("2026-11-01 09:00:00"), profil="TICARI"),
    ol("gonder_belirsiz", E(1), t("2026-11-01 09:05:00"), profil="TICARI"),
    ol("belirsiz_kesinlesti_kabul", E(1), t("2026-12-01 10:00:00"), profil="TICARI")],
   lambda p: {"sayilar": {k("2026-11" if p["ay"] == "gonderim" else "2026-12"): 1}, "usage": {
       t("2026-11-15 10:00:00"): ({"aylar": ["2026-09", "2026-10", "2026-11"], "aylik": {}} if p["pencere"] == "icinde_dahil"
                                  else {"aylar": ["2026-08", "2026-09", "2026-10"], "aylik": {}}),
       t("2026-12-05 10:00:00"): (
           {"aylar": ["2026-10", "2026-11", "2026-12"], "aylik": {k("2026-11" if p["ay"] == "gonderim" else "2026-12"): 1}}
           if p["pencere"] == "icinde_dahil" else
           {"aylar": ["2026-09", "2026-10", "2026-11"], "aylik": {k("2026-11"): 1} if p["ay"] == "gonderim" else {}}),
   }},
   referanslar=[t("2026-11-15 10:00:00"), t("2026-12-05 10:00:00")], acik_sorular=["S1"], kurallar=["K4", "K10"])

uc("U42-F1-bulunamadi-yeniden-belirsiz-11048",
   "F1 + S3: belirsiz 30.10 → 'bulunamadı' 31.10 → yeniden belirsiz 01.11 → yeniden gönderimde 11048 (kendi ETTN'i) 02.12: ay Kasım.",
   [ol("gonder_belirsiz", E(1), t("2026-10-30 10:00:00"), tur="esmm"),
    ol("durum_bulunamadi", E(1), t("2026-10-31 10:00:00"), tur="esmm"),
    ol("gonder_belirsiz", E(1), t("2026-11-01 08:00:00"), tur="esmm"),
    ol("zaten_gonderilmis_11048", E(1), t("2026-12-02 10:00:00"), tur="esmm")],
   lambda p: {"sayilar": ({} if p["e11048"] == "saymaz"
                          else {k("2026-11" if p["ay"] == "gonderim" else "2026-12", tur="esmm"): 1})},
   acik_sorular=["S1", "S3"], kurallar=["K10"])

uc("U43-F2-belirsiz-red-belirsiz-kesinlesme",
   "F2: belirsiz 30.09 → yeniden gönderim red 01.10 → yeniden belirsiz 15.10 → kabul 02.11: red izi kapatmaz, ay ilk açık iz (Eylül).",
   [ol("gonder_belirsiz", E(1), t("2026-09-30 22:00:00")),
    ol("gonder_red", E(1), t("2026-10-01 10:00:00")),
    ol("gonder_belirsiz", E(1), t("2026-10-15 10:00:00")),
    ol("belirsiz_kesinlesti_kabul", E(1), t("2026-11-02 10:00:00"))],
   lambda p: {"sayilar": {k("2026-09" if p["ay"] == "gonderim" else "2026-11"): 1}},
   acik_sorular=["S1"], kurallar=["K4", "K11"])

uc("U44-bulunamadi-sonra-yeni-deneme-olmadan-kabul",
   "Belirsiz 30.09 → 'bulunamadı' 01.10 → yeni gönderim yok → EDM kabul gösterir 05.10 (geç işlenmiş): sayılır (K1), ay ilk belirsiz (V6b, karar değil).",
   [ol("gonder_belirsiz", E(1), t("2026-09-30 23:00:00")),
    ol("durum_bulunamadi", E(1), t("2026-10-01 09:00:00")),
    ol("belirsiz_kesinlesti_kabul", E(1), t("2026-10-05 10:00:00"))],
   lambda p: {"sayilar": {k("2026-09" if p["ay"] == "gonderim" else "2026-10"): 1}},
   acik_sorular=["S1"], varsayimlar=["V6b"], kurallar=["K1", "K10"])

uc("U45-bulunamadi-sonra-iptal", "Belirsiz → 'bulunamadı' → Yalnız Programda İptal: sayılmaz (bulunamadı kabul değildir).",
   [ol("gonder_belirsiz", E(1), t("2026-10-10 10:00:00"), tur="earsiv"),
    ol("durum_bulunamadi", E(1), t("2026-10-11 10:00:00"), tur="earsiv"),
    ol("iptal", E(1), t("2026-10-12 10:00:00"), tur="earsiv")],
   lambda p: {"sayilar": {}}, kurallar=["K1", "K10"])


def _u46(p, ref):
    etk = p["geri_yukleme"] == "etkilemez"
    if ref == "Ra":    # kayıptan önce: E6 (Eylül), E1, E2, E3 (Ekim)
        aylik = {k("2026-09", tur="earsiv"): 1, k("2026-10", tur="earsiv"): 3}
    elif ref == "Rb":  # defter kayboldu; yeni kurulumda E4 ve iptal sonrası yeniden kabul edilen E6 (Ekim)
        aylik = {k("2026-10", tur="earsiv"): 2}
    elif ref == "Rc":  # geri yükleme anı: etkilemez → E1, E2 eklendi, E6 (Ekim) değişmedi; geri_alir → şirket defteri = yedek
        aylik = {k("2026-10", tur="earsiv"): 4} if etk else {k("2026-09", tur="earsiv"): 1, k("2026-10", tur="earsiv"): 2}
    else:              # Rd: + E5
        aylik = {k("2026-10", tur="earsiv"): 5} if etk else {k("2026-09", tur="earsiv"): 1, k("2026-10", tur="earsiv"): 3}
    if p["pencere"] == "icinde_dahil":
        return {"aylar": ["2026-08", "2026-09", "2026-10"], "aylik": aylik}
    return {"aylar": ["2026-07", "2026-08", "2026-09"], "aylik": {a: n for a, n in aylik.items() if a.startswith("2026-09")}}


_U46_REF = (("Ra", t("2026-10-08 12:00:00")), ("Rb", t("2026-10-10 12:00:00")), ("Rc", t("2026-10-11 09:00:00")),
            ("Rd", t("2026-10-12 12:00:00")))
uc("U46-yedekten-defter-kazanimi",
   "K12: yedek 07.10 18:00'de defterin kopyasını alır; 09.10'da kurulum taşınır, defter kaybolur; geri yükleme yedekteki eksik satırları (E1, E2) "
   "geri getirir, var olanı (iptal sonrası yeniden kabul edilen E6, Ekim) DEĞİŞTİRMEZ, hiçbir satırı silmez: sayı 2 → 4. Yedekten sonra yazılıp "
   "defterle kaybolan E3 geri gelmez (bilinen sınır).",
   [ol("gonder_kabul", E(6), t("2026-09-28 10:00:00"), tur="earsiv"),
    ol("gonder_kabul", E(1), t("2026-10-05 10:00:00"), tur="earsiv"),
    ol("gonder_kabul", E(2), t("2026-10-06 10:00:00"), tur="earsiv"),
    ol("iptal", E(6), t("2026-10-07 09:00:00"), tur="earsiv"),
    bakim("yedek_alindi", "001", t("2026-10-07 18:00:00")),
    ol("gonder_kabul", E(3), t("2026-10-08 10:00:00"), tur="earsiv"),
    {"olay": "sayac_defteri_kayboldu", "zaman": t("2026-10-09 09:00:00")},
    ol("gonder_kabul", E(4), t("2026-10-10 10:00:00"), tur="earsiv"),
    ol("gonder_kabul", E(6), t("2026-10-10 11:00:00"), tur="earsiv"),
    bakim("yedekten_geri_yuklendi", "001", t("2026-10-11 09:00:00"), yedek_zamani=t("2026-10-07 18:00:00")),
    ol("gonder_kabul", E(5), t("2026-10-12 10:00:00"), tur="earsiv")],
   lambda p: {"sayilar": ({k("2026-10", tur="earsiv"): 5} if p["geri_yukleme"] == "etkilemez"
                          else {k("2026-09", tur="earsiv"): 1, k("2026-10", tur="earsiv"): 3}),
              "usage": {r: _u46(p, ad) for ad, r in _U46_REF}},
   referanslar=[r for _, r in _U46_REF], acik_sorular=["S4"], kurallar=["K2", "K12"])

uc("U47-yedek-defteri-iki-sirket",
   "K12 + V15: 001'in yedeği defterin TAMAMINI taşır; defter kaybolunca 001'in yedeği geri yüklenir, 002'nin satırı da geri gelir.",
   [ol("gonder_kabul", E(1), t("2026-10-05 10:00:00"), sirket="001"),
    ol("gonder_kabul", E(2), t("2026-10-06 10:00:00"), sirket="002"),
    bakim("yedek_alindi", "001", t("2026-10-07 18:00:00")),
    {"olay": "sayac_defteri_kayboldu", "zaman": t("2026-10-09 09:00:00")},
    bakim("yedekten_geri_yuklendi", "001", t("2026-10-10 09:00:00"), yedek_zamani=t("2026-10-07 18:00:00"))],
   lambda p: {"sayilar": {k("2026-10"): 2 if p["geri_yukleme"] == "etkilemez" else 1}},
   acik_sorular=["S4"], varsayimlar=["V15"], kurallar=["K12"])

uc("U48-eski-yedekte-defter-kopyasi-yok",
   "Defter kaybolduktan sonra 2.4.7 öncesi (defter kopyası olmayan) yedek geri yüklenir: geri gelen satır yok; sonraki kabul sayılır.",
   [ol("gonder_kabul", E(1), t("2026-10-05 10:00:00")),
    {"olay": "sayac_defteri_kayboldu", "zaman": t("2026-10-06 09:00:00")},
    bakim("yedekten_geri_yuklendi", "001", t("2026-10-07 09:00:00"), yedek_zamani=t("2026-09-20 18:00:00")),
    ol("gonder_kabul", E(2), t("2026-10-08 10:00:00"))],
   lambda p: {"sayilar": {k("2026-10"): 1}}, kurallar=["K12"])


def uc_senaryolar():
    return [dict(s) for s in UC]


# ---- RASTGELE (tohumlu) ---------------------------------------------------------------------------------------------
AKISLAR = (  # (ad, ağırlık)
    ("kabul", 30), ("red", 4), ("red_yeniden_kabul", 6), ("red_elle_kabul", 3), ("belirsiz_kesin_kabul", 8),
    ("belirsiz_kesin_red", 3), ("belirsiz_11048", 5), ("belirsiz_yeniden_kabul", 4), ("kabul_gurultu", 10),
    ("yetim_kesinlesme", 3), ("ilk_11048", 3), ("kabul_iptal_ayni_ettn", 3), ("belirsiz_sonucsuz", 4),
    ("red_araya_girer", 3), ("iki_belirsiz", 3), ("iki_kullanici", 3), ("belirsiz_11048_kesin", 3), ("yalniz_iptal", 2),
    ("kabul_silindi", 3), ("belirsiz_red_kesin", 2),
    ("f1_bulunamadi_belirsiz_kesin", 4), ("f1_bulunamadi_belirsiz_11048", 3), ("f2_red_belirsiz_kesin", 3),
    ("bulunamadi_iptal", 2),
)
BELIRSIZ_AKISLARI = {"belirsiz_kesin_kabul", "belirsiz_kesin_red", "belirsiz_11048", "belirsiz_yeniden_kabul", "belirsiz_sonucsuz",
                     "red_araya_girer", "iki_belirsiz", "belirsiz_11048_kesin", "belirsiz_red_kesin", "f1_bulunamadi_belirsiz_kesin",
                     "f1_bulunamadi_belirsiz_11048", "f2_red_belirsiz_kesin", "bulunamadi_iptal"}


def _ay(an):
    return an.astimezone(TR).strftime("%Y-%m")


def rastgele_senaryo(tohum, belge_sayisi=VARSAYILAN_BELGE):
    rng = random.Random(tohum)
    bas = datetime(2026, 10, 1, tzinfo=TR)
    bitis = datetime(2027, 11, 30, 23, 59, 59, tzinfo=TR)
    ay_baslari = [datetime(2026 + (m // 12), m % 12 + 1, 1, tzinfo=TR) for m in range(10, 24)]  # 2026-11 … 2027-12
    kullanilan = set()
    olaylar, belgeler, gecmis = [], [], []

    def benzersiz(an):
        an = an.replace(microsecond=0)
        while int(an.timestamp()) in kullanilan:
            an += timedelta(seconds=1)
        kullanilan.add(int(an.timestamp()))
        return an

    def bosluk():
        r = rng.random()
        if r < 0.4:
            s = rng.randint(1, 300)
        elif r < 0.7:
            s = rng.randint(300, 3 * 3600)
        elif r < 0.9:
            s = rng.randint(3 * 3600, 72 * 3600)
        else:
            s = rng.randint(3 * 86400, 45 * 86400)
        return timedelta(seconds=s)

    def ilk_an(belirsiz_mi):
        if rng.random() < (0.4 if belirsiz_mi else 0.15):  # ay sınırına yığ
            sinir = rng.choice(ay_baslari)
            return benzersiz(sinir + timedelta(seconds=rng.randint(-1800 if belirsiz_mi else -3 * 3600, 3 * 3600)))
        return benzersiz(bas + timedelta(seconds=rng.randint(0, int((bitis - bas).total_seconds()))))

    def yaz(an):
        if rng.random() < 0.05:
            return an.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        return an.astimezone(TR).strftime("%Y-%m-%dT%H:%M:%S+03:00")

    def belge_bilgisi():
        sirket = rng.choices(("001", "002", "003"), (55, 35, 10))[0]
        ortam = rng.choices(("live", "test"), (70, 30))[0]
        tur = rng.choices(("efatura", "earsiv", "esmm"), (45, 40, 15))[0]
        ek = {}
        if tur == "efatura":
            profil = rng.choices(("TEMEL", "TICARI", None), (50, 40, 10))[0]
            if profil:
                ek["profil"] = profil
        return sirket, ortam, tur, ek

    def belge_ekle(sirket, ortam, tur, ek, ettn, adimlar, kabuller):
        for olay, an in adimlar:
            o = {"sirket": sirket, "ortam": ortam, "tur": tur, "ettn": ettn, "olay": olay, "zaman": yaz(an)}
            o.update(ek)
            olaylar.append((an, o))
        belgeler.append({"sirket": sirket, "ortam": ortam, "tur": tur, "ettn": ettn, "kabuller": kabuller})

    adlar = [a for a, _ in AKISLAR]
    agirliklar = [w for _, w in AKISLAR]
    for _ in range(belge_sayisi):
        ad = rng.choices(adlar, agirliklar)[0]
        sirket, ortam, tur, ek = belge_bilgisi()
        ettn = str(uuid.UUID(int=rng.getrandbits(128), version=4))
        T = [ilk_an(ad in BELIRSIZ_AKISLARI)]

        def s():
            T.append(benzersiz(T[-1] + bosluk()))
            return T[-1]

        t0 = T[0]
        # kabuller: (kesinleşme/kabul anı, EDM'nin kabul ettiği gönderim anı, koşul) — akıştan bilinir.
        if ad == "kabul":
            adim, kab = [("gonder_kabul", t0)], [(t0, t0, None)]
        elif ad == "red":
            adim, kab = [("gonder_red", t0)] + ([("gonder_red", s())] if rng.random() < 0.5 else []), []
        elif ad == "red_yeniden_kabul":
            t1 = s()
            adim, kab = [("gonder_red", t0), ("yeniden_deneme_kabul", t1)], [(t1, t1, None)]
        elif ad == "red_elle_kabul":
            t1 = s()
            adim, kab = [("gonder_red", t0), ("gonder_kabul", t1)], [(t1, t1, None)]
        elif ad == "belirsiz_kesin_kabul":
            adim = [("gonder_belirsiz", t0)] + ([("durum_sorgusu", s())] if rng.random() < 0.5 else [])
            t2 = s()
            adim.append(("belirsiz_kesinlesti_kabul", t2))
            kab = [(t2, t0, None)]
        elif ad == "belirsiz_kesin_red":
            adim, kab = [("gonder_belirsiz", t0), ("belirsiz_kesinlesti_red", s())], []
        elif ad == "belirsiz_11048":
            t1 = s()
            adim, kab = [("gonder_belirsiz", t0), ("zaten_gonderilmis_11048", t1)], [(t1, t0, "kesinlestirir")]
        elif ad == "belirsiz_yeniden_kabul":
            t1 = s()
            adim, kab = [("gonder_belirsiz", t0), ("yeniden_deneme_kabul", t1)], [(t1, t1, None)]
        elif ad == "kabul_gurultu":
            adim, kab = [("gonder_kabul", t0), ("durum_sorgusu", s()), ("zaten_gonderilmis_11048", s()), ("iptal", s())], [(t0, t0, None)]
        elif ad == "yetim_kesinlesme":
            adim, kab = [("belirsiz_kesinlesti_kabul", t0)], []
            gecmis.append({"sirket": sirket, "ortam": ortam, "tur": tur, "ettn": ettn, "durum": "belirsiz",
                           "zaman": yaz(benzersiz(bas - timedelta(seconds=rng.randint(3600, 60 * 86400)))), "surum": "2.4.6"})
        elif ad == "ilk_11048":
            adim, kab = [("zaten_gonderilmis_11048", t0), ("durum_sorgusu", s())], []
            gecmis.append({"sirket": sirket, "ortam": ortam, "tur": tur, "ettn": ettn, "durum": "kabul",
                           "zaman": yaz(benzersiz(bas - timedelta(seconds=rng.randint(3600, 60 * 86400)))), "surum": "2.4.6"})
        elif ad == "kabul_iptal_ayni_ettn":
            t1, t2 = s(), s()
            adim, kab = [("gonder_kabul", t0), ("iptal", t1), ("gonder_kabul", t2)], [(t0, t0, None), (t2, t2, None)]
        elif ad == "belirsiz_sonucsuz":
            adim, kab = [("gonder_belirsiz", t0), ("durum_sorgusu", s())], []
        elif ad == "red_araya_girer":
            t1, t2, t3 = s(), s(), s()
            adim = [("gonder_belirsiz", t0), ("belirsiz_kesinlesti_red", t1), ("gonder_belirsiz", t2), ("belirsiz_kesinlesti_kabul", t3)]
            kab = [(t3, t2, None)]
        elif ad == "iki_belirsiz":
            t1, t2 = s(), s()
            adim, kab = [("gonder_belirsiz", t0), ("gonder_belirsiz", t1), ("belirsiz_kesinlesti_kabul", t2)], [(t2, t0, None)]
        elif ad == "iki_kullanici":
            t1 = s()
            adim, kab = [("gonder_kabul", t0), ("gonder_kabul", t1)], [(t0, t0, None), (t1, t1, None)]
        elif ad == "belirsiz_11048_kesin":
            t1, t2 = s(), s()
            adim = [("gonder_belirsiz", t0), ("zaten_gonderilmis_11048", t1), ("belirsiz_kesinlesti_kabul", t2)]
            kab = [(t1, t0, "kesinlestirir"), (t2, t0, None)]
        elif ad == "yalniz_iptal":
            adim, kab = [("iptal", t0)], []
        elif ad == "kabul_silindi":
            adim, kab = [("gonder_kabul", t0), ("belge_silindi", s())], [(t0, t0, None)]
        elif ad == "belirsiz_red_kesin":  # F2: sayılır, ay ilk açık iz
            t1, t2 = s(), s()
            adim, kab = [("gonder_belirsiz", t0), ("gonder_red", t1), ("belirsiz_kesinlesti_kabul", t2)], [(t2, t0, None)]
        elif ad == "f1_bulunamadi_belirsiz_kesin":  # F1: ay 'bulunamadı'dan sonraki gönderim
            t1, t2, t3 = s(), s(), s()
            adim = [("gonder_belirsiz", t0), ("durum_bulunamadi", t1), ("gonder_belirsiz", t2), ("belirsiz_kesinlesti_kabul", t3)]
            kab = [(t3, t2, None)]
        elif ad == "f1_bulunamadi_belirsiz_11048":  # F1 + S3
            t1, t2, t3 = s(), s(), s()
            adim = [("gonder_belirsiz", t0), ("durum_bulunamadi", t1), ("gonder_belirsiz", t2), ("zaten_gonderilmis_11048", t3)]
            kab = [(t3, t2, "kesinlestirir")]
        elif ad == "f2_red_belirsiz_kesin":  # F2: gonder_red izi kapatmaz → ilk açık iz
            t1, t2, t3 = s(), s(), s()
            adim = [("gonder_belirsiz", t0), ("gonder_red", t1), ("gonder_belirsiz", t2), ("belirsiz_kesinlesti_kabul", t3)]
            kab = [(t3, t0, None)]
        elif ad == "bulunamadi_iptal":
            adim, kab = [("gonder_belirsiz", t0), ("durum_bulunamadi", s()), ("iptal", s())], []
        else:  # pragma: no cover
            raise AssertionError(ad)
        belge_ekle(sirket, ortam, tur, ek, ettn, adim, kab)

        if ad == "kabul" and rng.random() < 0.06:  # aynı ETTN başka şirkette (veri kopyası) — S2
            diger = rng.choice([x for x in ("001", "002", "003") if x != sirket])
            tk = benzersiz(t0 + rng.choice((-1, 1)) * bosluk())
            belge_ekle(diger, ortam, tur, ek, ettn, [("gonder_kabul", tk)], [(tk, tk, None)])
        elif ad == "kabul" and rng.random() < 0.05:  # aynı ETTN öbür ortamda — K5
            diger = "test" if ortam == "live" else "live"
            tk = benzersiz(t0 + rng.choice((-1, 1)) * bosluk())
            belge_ekle(sirket, diger, tur, ek, ettn, [("gonder_kabul", tk)], [(tk, tk, None)])

    olaylar.sort(key=lambda x: x[0])
    anlar = [an for an, _ in olaylar]
    liste = [o for _, o in olaylar]
    if tohum != 1:
        rng.shuffle(liste)
    # Referanslar: bir olayın tam anı, bir ayın 1'i 00:00:00, rastgele bir an, son olaydan 1 gün sonra.
    secilen = rng.choice(anlar)
    referanslar = sorted({secilen, rng.choice(ay_baslari),
                          bas + timedelta(seconds=rng.randint(0, int((bitis - bas).total_seconds()))),
                          max(anlar) + timedelta(days=1)})
    referanslar = [r.astimezone(TR).strftime("%Y-%m-%dT%H:%M:%S+03:00") for r in referanslar]

    def uretici(p):
        """Akış düzeyinde ikinci hesap (modelden ayrı): anahtar başına en erken kabul, seçilen ayla."""
        en_erken = {}
        for b in belgeler:
            ettn_n = b["ettn"].lower()
            anahtar = (b["sirket"], b["ortam"], ettn_n) if p["anahtar"] == "sirket_ettn_ortam" else (b["ortam"], ettn_n)
            for kes, gon, kosul in b["kabuller"]:
                if kosul == "kesinlestirir" and p["e11048"] != "kesinlestirir":
                    continue
                if anahtar not in en_erken or kes < en_erken[anahtar][0]:
                    en_erken[anahtar] = (kes, gon, b["ortam"], b["tur"])
        sayilar = {}
        for kes, gon, ortam, tur in en_erken.values():
            anahtar = f"{_ay(kes if p['ay'] == 'kesinlesme' else gon)}|{ortam}|{tur}"
            sayilar[anahtar] = sayilar.get(anahtar, 0) + 1
        return {"sayilar": dict(sorted(sayilar.items()))}

    return {
        "ad": f"R{tohum}-rastgele-{belge_sayisi}-belge", "tur": "rastgele", "tohum": tohum,
        "aciklama": (f"Tohum {tohum}: {belge_sayisi} belge, {len(AKISLAR)} akış türü (F1/F2 dahil), 3 şirket, iki ortam, 14 ay (yıl dönümü dahil), "
                     f"ay sınırına yığılmış gönderimler, %5 UTC yazımlı saat, aynı ETTN başka şirkette / öbür ortamda; "
                     + ("kronolojik sıra." if tohum == 1 else "karışık sıra.")),
        "kurallar": ["K1", "K2", "K3", "K4", "K5", "K6", "K7", "K8", "K10", "K11"], "acik_sorular": ["S1", "S2", "S3", "S5"], "varsayimlar": [],
        "yapay": False, "gecmis": gecmis, "referanslar": referanslar, "olaylar": liste, "uretici": uretici,
    }


def tum_senaryolar(belge_sayisi=VARSAYILAN_BELGE):
    return uc_senaryolar() + [rastgele_senaryo(tohum, belge_sayisi) for tohum in (1, 2, 3)]


# ---- beklenen ↔ model denetimi ve kabul.json -------------------------------------------------------------------------
def _sifirsiz(d):
    return {a: b for a, b in d.items() if b}


def beklenen_denetle(senaryo, p, sonuc):
    """Elle / üretici beklentisi ile modelin çıktısı; fark satırları döner."""
    hatalar = []
    ad = f"{senaryo['ad']} [{kahin.birlesim_adi(p)}]"
    beklenen = senaryo["el"](p) if "el" in senaryo else senaryo["uretici"](p) if "uretici" in senaryo else None
    if beklenen is None:
        return hatalar
    if _sifirsiz(beklenen["sayilar"]) != _sifirsiz(sonuc["sayilar"]):
        hatalar.append(f"{ad}: sayilar beklenen {_sifirsiz(beklenen['sayilar'])}, model {_sifirsiz(sonuc['sayilar'])}")
    for r, bu in beklenen.get("usage", {}).items():
        mu = sonuc["usage"].get(r)
        if mu is None:
            hatalar.append(f"{ad}: usage {r} modelde yok")
            continue
        if mu["aylar"] != bu["aylar"]:
            hatalar.append(f"{ad}: usage {r} aylar beklenen {bu['aylar']}, model {mu['aylar']}")
        if _sifirsiz(mu["aylik"]) != _sifirsiz(bu["aylik"]):
            hatalar.append(f"{ad}: usage {r} aylik beklenen {_sifirsiz(bu['aylik'])}, model {_sifirsiz(mu['aylik'])}")
        el_toplam = {}
        for anahtar, n in bu["aylik"].items():
            _, ortam, tur = anahtar.split("|")
            el_toplam[f"{ortam}|{tur}"] = el_toplam.get(f"{ortam}|{tur}", 0) + n
            el_toplam[f"{ortam}|toplam"] = el_toplam.get(f"{ortam}|toplam", 0) + n
        if _sifirsiz(mu["toplam"]) != el_toplam:
            hatalar.append(f"{ad}: usage {r} toplam beklenen {el_toplam}, model {_sifirsiz(mu['toplam'])}")
    return hatalar


ALANLAR = ("ad", "tur", "tohum", "aciklama", "kurallar", "acik_sorular", "varsayimlar", "yapay", "gecmis", "referanslar", "olaylar")


def kabul_uret(belge_sayisi=VARSAYILAN_BELGE, model=None):
    model = model or kahin.Kahin
    hatalar = []
    cikti = []
    for s in tum_senaryolar(belge_sayisi):
        gruplar = {}
        for p in kahin.birlesimler():
            sonuc = model(p).calistir(s["olaylar"], s["referanslar"], s["gecmis"])
            hatalar += beklenen_denetle(s, p, sonuc)
            anahtar = json.dumps(sonuc, sort_keys=True, ensure_ascii=False)
            gruplar.setdefault(anahtar, (sonuc, []))[1].append(kahin.birlesim_adi(p))
        toplam = len(list(kahin.birlesimler()))
        beklenen = [{"birlesimler": "hepsi" if len(adlar) == toplam else adlar, **sonuc} for sonuc, adlar in gruplar.values()]
        kayit = {a: s.get(a) for a in ALANLAR}
        kayit["beklenen"] = beklenen
        cikti.append(kayit)
    kabul = {
        "surum": 1,
        "aciklama": ("DestekOfis 2.4.7 EDM kabul edilen gönderim sayacı (B1) ve /v1/check usage (B2) — temiz oda kâhini kabul kümesi. "
                     "Programın kodu görülmeden karar metninden üretildi; kurallar/varsayımlar/açık sorular README.md."),
        "kaynak": ["CLAUDE.md: 2.4.7 KAPSAMI — EDM İŞ ORTAKLIĞI", "docs/erp/OTURUM-DEVIR-TESLIM-2.4.7.md §3.3 B1, B2",
                   "docs/erp/2.4.7-IS-LISTESI.md: Nasıl bozulur?",
                   "docs/2.4.7-IS-LISTESI.md: KARARLAR — EDM sayacı (S1–S5) ve AÇIK SORU → KARAR (F1, F2, sayaç defteri yedekte), 27.10.2026"],
        "uretim": f"python3 -I test/bagimsiz/edm-sayac/senaryolar.py (rastgele senaryo başına {belge_sayisi} belge, tohum 1–3)",
        "secilen_birlesim": kahin.birlesim_adi(kahin.SECILEN),
        "parametreler": {a: list(v) for a, v in kahin.PARAMETRELER.items()},
        "birlesim_bicimi": "ay=…;anahtar=…;e11048=…;pencere=…;geri_yukleme=… (bu sırayla)",
        "senaryolar": cikti,
    }
    return kabul, hatalar


def json_metni(kabul):
    """Olaylar satır başına bir nesne; beklenen grupları satır başına bir nesne (fark okunur kalsın)."""
    d = lambda x: json.dumps(x, ensure_ascii=False)
    satirlar = ["{"]
    for a, v in kabul.items():
        if a != "senaryolar":
            satirlar.append(f" {d(a)}: {d(v)},")
    satirlar.append(' "senaryolar": [')
    for i, s in enumerate(kabul["senaryolar"]):
        satirlar.append("  {")
        alanlar = list(s.items())
        for j, (a, v) in enumerate(alanlar):
            virgul = "," if j < len(alanlar) - 1 else ""
            if isinstance(v, list) and a in ("olaylar", "gecmis", "beklenen") and v:
                satirlar.append(f"   {d(a)}: [")
                satirlar += [f"    {d(x)}{',' if n < len(v) - 1 else ''}" for n, x in enumerate(v)]
                satirlar.append(f"   ]{virgul}")
            else:
                satirlar.append(f"   {d(a)}: {d(v)}{virgul}")
        satirlar.append("  }" + ("," if i < len(kabul["senaryolar"]) - 1 else ""))
    satirlar.append(" ]")
    satirlar.append("}")
    return "\n".join(satirlar) + "\n"


def main(argv):
    belge = VARSAYILAN_BELGE
    if "--belge" in argv:
        belge = int(argv[argv.index("--belge") + 1])
    kabul, hatalar = kabul_uret(belge)
    if hatalar:
        print(f"MODEL ↔ BEKLENEN AYRIŞTI ({len(hatalar)} fark); kabul.json YAZILMADI:")
        for h in hatalar[:50]:
            print("  " + h)
        return 1
    n_olay = sum(len(s["olaylar"]) for s in kabul["senaryolar"])
    if belge != VARSAYILAN_BELGE:
        print(f"{len(kabul['senaryolar'])} senaryo, {n_olay} olay: model, elle ve üretici beklentileriyle 32 birleşimde aynı (dosya yazılmadı: --belge {belge}).")
        return 0
    with open(KABUL_YOLU, "w", encoding="utf-8", newline="\n") as f:
        f.write(json_metni(kabul))
    print(f"kabul.json yazıldı: {len(kabul['senaryolar'])} senaryo, {n_olay} olay, 32 birleşim.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
