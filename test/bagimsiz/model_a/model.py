#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""DestekOfis bağımsız muhasebe kâhini — model A (temiz oda).

Kaynak YALNIZ şu üç belgedir:
  docs/BANKA-MODULU-PLAN.md (Sürüm 3), docs/BANKA-MODULU-TALIMAT.md,
  test/bagimsiz/SENARYO-DILI.md (dil sürümü destekofis-senaryo/1).
Programın kodu, git geçmişi, KANIT/ESLEME belgeleri ve öbür bağımsız model okunmadı.
Belirsiz yerlerdeki kararlar ve dayanakları: KARARLAR.md (bu klasörde).

Kullanım:
  python3 -I model.py <senaryo.json> [--plan-denetimi]

Çıkış kodları:
  0  başarılı; stdout'a SENARYO-DILI §8 biçiminde JSON (sort_keys, 2 boşluk girinti)
  1  kullanım ya da dosya hatası
  2  senaryo geçersiz (SENARYO-DILI §13 ya da bir "senaryo kurmaz" kuralı); neden stderr'de
  3  kâhin iç hatası: bir değişmez bozuldu (fiş dengesi, mizan dengesi, cari değişmezi)
  4  --plan-denetimi verildiyse: kâhin bir `kontrol` adımının `planBeklenen` sayısını vermedi

Tutarlar her yerde tamsayı kuruştur; kayan nokta kullanılmaz. Saat ve ağ kullanılmaz.
"""

import datetime
import itertools
import json
import os
import re
import sys
from collections import defaultdict

DIL = "destekofis-senaryo/1"
MAX_KURUS = 10 ** 14          # 1e12 TL [PLAN §9.2/9]
ROLLER = {"yonetici", "muhasebe", "personel"}
HESAP_TURLERI = {"vadesiz", "ticari", "vadeli", "diger", "kurumsal_kart", "kredi"}
TUR_102 = {"vadesiz", "ticari", "vadeli", "diger"}
HAVALE_UYGUN = {"vadesiz", "ticari", "diger"}          # SENARYO-DILI §5.2 [PLAN §3.5 tablo]
KMH_TURLERI = {"vadesiz", "ticari", "diger"}
ANA_KOD = {"vadesiz": "102", "ticari": "102", "vadeli": "102", "diger": "102",
           "kurumsal_kart": "309", "kredi": "300"}
POLITIKALAR = {"uyar", "engelle", "kontrol_yok"}
MASRAF_TURLERI = {"EFT", "FAST", "Havale", "SWIFT", "Hesap İşletim", "Döviz İşlem", "Diğer"}
VERGI_KIPLERI = {"bsmv_dahil", "bsmv_haric", "yok", "kdv_dahil", "kdv_haric"}
UCRET_VERGI = {"bsmv_haric", "bsmv_dahil", "yok"}
BANKA_FISI = {"banka_masraf", "faiz_geliri", "faiz_gideri", "diger_gelir", "diger_gider",
              "kart_borcu_odeme", "kredi_kullanim", "kredi_odeme"}
TERS_KAYDEDILIR = {"transfer", "banka_masraf", "faiz_geliri", "faiz_gideri", "diger_gelir",
                   "diger_gider", "kart_borcu_odeme", "kredi_kullanim", "kredi_odeme"}
SILINEBILIR = {"cari_tahsilat", "cari_odeme", "taksit_tahsilat", "kasa_hareket", "kasa_banka"}
# BELİRSİZ-4: bu işlemlerde Benzer İşlem tanımsız; aynı gün/hesap/tutarlı ikincisi benzerOnay ister.
BELIRSIZ4_ISLEMLER = {"kasa_banka", "transfer"} | BANKA_FISI
# `tarih` alanı alabilen (deftere yazan) işlemler [SENARYO-DILI §3.2]
TARIHLI = {"kasa_acilis", "kasa_hareket", "fatura", "iade", "cari_tahsilat", "cari_odeme",
           "taksit_tahsilat", "kasa_banka", "transfer", "banka_masraf", "faiz_geliri",
           "faiz_gideri", "diger_gelir", "diger_gider", "kart_borcu_odeme", "kredi_kullanim",
           "kredi_odeme"}
ORTAK_ALANLAR = {"id", "islem", "kullanici", "istekKimligi", "benzerOnay", "yineDeKaydet",
                 "ayniAnda", "not"}
# İstek kimliği gövdesinden çıkarılan alanlar [SENARYO-DILI §5.4]
GOVDE_DISI = {"id", "ad", "not", "istekKimligi", "benzerOnay", "yineDeKaydet", "ayniAnda"}
# Takma ad gösteren anahtarlar (gövde karşılaştırmasında kimliğe çevrilir)
REF_ANAHTARLARI = {"hesap", "cari", "urun", "asilFatura", "kapatilacakFatura", "kart", "kaynak",
                   "hedef", "kredi", "saglayici"}

# Her işlemin alanları. Demet = ikisinden tam biri ("tutar" ya da "tutarHam").
ALANLAR = {
    "saat": (["bugun"], []),
    "ayar": ([], ["kasaEksiBakiye", "benzerIslemUyarisi"]),
    "donem_kilidi": (["kilitTarihi"], []),
    "hesap_ac": (["ad", "banka", "hesapAdi", "tur", "paraBirimi", "acilisTarihi",
                  ("acilisBakiyesi", "acilisBakiyesiHam")],
                 ["kod", "iban", "bakiyeDogrulandi", "kmhLimiti", "kartLimiti"]),
    "hesap_durum": (["hesap", "durum"], []),
    "hesap_eksi_politika": (["hesap", "politika"], []),
    "acilis_duzelt": (["hesap", "acilisTarihi", ("acilisBakiyesi", "acilisBakiyesiHam")],
                      ["bakiyeDogrulandi"]),
    "kasa_acilis": (["tutar"], []),
    "kasa_hareket": (["yon", "tutar", "aciklama"], ["ad"]),
    "cari_ac": (["ad", "unvan", "tur"], ["iban"]),
    "urun_ac": (["ad", "urunAdi", "birim"], []),
    "stok_giris": (["urun", "miktar"], []),
    "fatura": (["ad", "tur", "cari", "kalemler"], ["odeme"]),
    "iade": (["ad", "asilFatura", "kalemler", "geri"], []),
    "cari_tahsilat": (["cari", ("tutar", "tutarHam"), "yol"], ["ad", "hesap", "kapatilacakFatura"]),
    "cari_odeme": (["cari", ("tutar", "tutarHam"), "yol"], ["ad", "hesap", "kapatilacakFatura"]),
    "taksit_tahsilat": (["kart", "tutar", "yol"], ["ad", "hesap", "taksitNo"]),
    "kasa_banka": (["yon", "tutar"], ["ad", "hesap"]),
    "transfer": (["kaynak", "hedef", ("tutar", "tutarHam")], ["ad", ("ucret", "ucretHam"), "ucretVergi"]),
    "banka_masraf": (["hesap", ("tutar", "tutarHam"), "masrafTuru", "vergi"],
                     ["ad", "saglayici", "fatura", "kdvOrani"]),
    "faiz_geliri": (["hesap", ("brut", "brutHam"), "stopajOrani"], ["ad"]),
    "faiz_gideri": (["hesap", ("tutar", "tutarHam")], ["ad"]),
    "diger_gelir": (["hesap", ("tutar", "tutarHam")], ["ad"]),
    "diger_gider": (["hesap", ("tutar", "tutarHam")], ["ad"]),
    "kart_borcu_odeme": (["kaynak", "kart", ("tutar", "tutarHam")], ["ad"]),
    "kredi_kullanim": (["kredi", "hedef", ("tutar", "tutarHam")], ["ad"]),
    "kredi_odeme": (["kredi", "kaynak", ("anapara", "anaparaHam")], ["ad", ("faiz", "faizHam")]),
    "ters_kayit": (["hedef"], ["ad"]),
    "sil": (["hedef"], []),
    "kontrol": ([], ["planMetni", "planBeklenen"]),
}

# Her işlemde hangi alan hangi türde takma ad tanımlar / anar
TANIMLAR = {
    "hesap_ac": {"ad": "hesap"}, "cari_ac": {"ad": "cari"}, "urun_ac": {"ad": "urun"},
    "fatura": {"ad": "fatura"}, "iade": {"ad": "fatura"},
}
for _i in ("kasa_hareket", "cari_tahsilat", "cari_odeme", "taksit_tahsilat", "kasa_banka", "transfer",
           "banka_masraf", "faiz_geliri", "faiz_gideri", "diger_gelir", "diger_gider",
           "kart_borcu_odeme", "kredi_kullanim", "kredi_odeme", "ters_kayit"):
    TANIMLAR[_i] = {"ad": "hareket"}
REFERANSLAR = {
    "hesap_durum": {"hesap": "hesap"}, "hesap_eksi_politika": {"hesap": "hesap"},
    "acilis_duzelt": {"hesap": "hesap"}, "stok_giris": {"urun": "urun"},
    "fatura": {"cari": "cari"}, "iade": {"asilFatura": "fatura"},
    "cari_tahsilat": {"cari": "cari", "hesap": "hesap", "kapatilacakFatura": "fatura"},
    "cari_odeme": {"cari": "cari", "hesap": "hesap", "kapatilacakFatura": "fatura"},
    "taksit_tahsilat": {"kart": "kart", "hesap": "hesap"},
    "kasa_banka": {"hesap": "hesap"},
    "transfer": {"kaynak": "hesap", "hedef": "hesap"},
    "banka_masraf": {"hesap": "hesap", "saglayici": "cari"},
    "faiz_geliri": {"hesap": "hesap"}, "faiz_gideri": {"hesap": "hesap"},
    "diger_gelir": {"hesap": "hesap"}, "diger_gider": {"hesap": "hesap"},
    "kart_borcu_odeme": {"kaynak": "hesap", "kart": "hesap"},
    "kredi_kullanim": {"kredi": "hesap", "hedef": "hesap"},
    "kredi_odeme": {"kredi": "hesap", "kaynak": "hesap"},
    "ters_kayit": {"hedef": "hareket"}, "sil": {"hedef": "hareket"},
}

ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,31}$")
AD_RE = re.compile(r"^[A-Z][A-Z0-9_]{0,15}$")
TARIH_RE = re.compile(r"^([0-9]{2})\.([0-9]{2})\.([0-9]{4})$")
TUTAR_RE = re.compile(r"^[0-9]{1,13}(,[0-9]{1,2})?$")
ORAN_RE = re.compile(r"^[0-9]{1,3}(,[0-9]{1,2})?$")
HAM_RE = re.compile(r"^(-?)([0-9]+)(?:,([0-9]+))?$")
IBAN_RE = re.compile(r"^TR[0-9]{24}$")


class SenaryoHatasi(Exception):
    """Senaryo geçersiz ya da kâhinin karar vermediği (BELİRSİZ) bir durumu kuruyor."""


class KahinHatasi(Exception):
    """Kâhinin kendi değişmezi bozuldu (programlama hatası)."""


class Dur(Exception):
    """İşlem içi: bu ihlalden sonra başka denetim yapılamaz."""


# --------------------------------------------------------------------------------------------
# Yardımcılar
# --------------------------------------------------------------------------------------------

def rh(a, b):
    """Yarım birim sıfırdan uzağa yuvarlamalı bölme; a ≥ 0, b > 0 [SENARYO-DILI §6.1]."""
    if not isinstance(a, int) or not isinstance(b, int) or a < 0 or b <= 0:
        raise KahinHatasi("rh: geçersiz bağımsız değişken %r / %r" % (a, b))
    return (2 * a + b) // (2 * b)


def tarih_coz(s, yer):
    if not isinstance(s, str):
        raise SenaryoHatasi("%s: tarih metin olmalı (gg.aa.yyyy)" % yer)
    m = TARIH_RE.match(s)
    if not m:
        raise SenaryoHatasi("%s: tarih biçimi gg.aa.yyyy değil: %r" % (yer, s))
    try:
        return datetime.date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
    except ValueError:
        raise SenaryoHatasi("%s: geçersiz takvim günü: %r" % (yer, s))


def tarih_yaz(d):
    return "%02d.%02d.%04d" % (d.day, d.month, d.year)


def tutar_coz(s, yer, sifir_olur=False, eksi_olur=False):
    """Senaryo tutar metni → kuruş [SENARYO-DILI §3.3]."""
    if not isinstance(s, str):
        raise SenaryoHatasi("%s: tutar metin olmalı" % yer)
    eksi = False
    if eksi_olur and s.startswith("-"):
        eksi, s = True, s[1:]
    if not TUTAR_RE.match(s):
        raise SenaryoHatasi("%s: tutar biçimi geçersiz: %r" % (yer, s))
    tam, _, ond = s.partition(",")
    k = int(tam) * 100 + (int(ond) * 10 if len(ond) == 1 else (int(ond) if ond else 0))
    if k > MAX_KURUS:
        raise SenaryoHatasi("%s: tutar 1e12 TL'yi aşıyor" % yer)
    if k == 0 and (eksi or not sifir_olur):
        raise SenaryoHatasi("%s: tutar sıfırdan büyük olmalı" % yer)
    return -k if eksi else k


def oran_coz(s, yer):
    """Yüzde metni → baz puan (%2,5 → 250) [SENARYO-DILI §3.3]."""
    if not isinstance(s, str) or not ORAN_RE.match(s):
        raise SenaryoHatasi("%s: oran biçimi geçersiz: %r" % (yer, s))
    tam, _, ond = s.partition(",")
    return int(tam) * 100 + (int(ond) * 10 if len(ond) == 1 else (int(ond) if ond else 0))


def iban_gecerli(s):
    if not IBAN_RE.match(s):
        return False
    r = s[4:] + s[:4]
    n = "".join(str(int(c, 36)) for c in r)
    return int(n) % 97 == 1


def kalem_hesapla(q, f, r, dahil, p):
    """Fatura kalemi: (matrah, kdv, toplam) kuruş [SENARYO-DILI §6.3]."""
    brut = q * f
    if dahil:
        if p == 0:
            m = rh(brut * 100, 100 + r)
            return m, brut - m, brut
        h = rh(brut * 100, 100 + r)
        m = h - rh(h * p, 10000)
        k = rh(m * r, 100)
        return m, k, m + k
    m = brut - rh(brut * p, 10000)
    k = rh(m * r, 100)
    return m, k, m + k


class Ihlaller:
    """Bir adımın ret nedenleri; grup = SENARYO-DILI §5.6 önceliği."""

    def __init__(self):
        self.liste = []

    def ekle(self, grup, durum, kod=None, dayanak=None, neden=""):
        self.liste.append((grup, len(self.liste), durum, kod, dayanak, neden))

    def gruplar(self):
        return {g for g, *_ in self.liste}

    def __bool__(self):
        return bool(self.liste)


class Degisim:
    """Bir adımın yazacağı her şey; ancak bütün denetimler geçerse uygulanır."""

    def __init__(self):
        self.yeni = []            # (tarih, [(kod, borc, alacak, cari_anahtari|None)], tur)
        self.silinen = []         # fiş kimlikleri
        self.uygula = []          # işlendiğinde çağrılan işlevler (fiş kimlikleri listesiyle)
        self.benzer = None        # Benzer İşlem anahtarı (yalnız kapsamdaki hesaba bağlı satır)
        self.eksi_denetimi = True # açılış işlemlerinde False (K-6)


# --------------------------------------------------------------------------------------------
# Senaryo geçerlilik denetimi (§13)
# --------------------------------------------------------------------------------------------

def _alan_denetle(adim, yer):
    islem = adim["islem"]
    zor, ist = ALANLAR[islem]
    izinli = set(ORTAK_ALANLAR)
    if islem in TARIHLI:
        izinli.add("tarih")
    for a in zor + ist:
        if isinstance(a, tuple):
            izinli.update(a)
        else:
            izinli.add(a)
    for k in adim:
        if k not in izinli:
            raise SenaryoHatasi("%s: bilinmeyen alan %r (%s)" % (yer, k, islem))
    for a in zor:
        if isinstance(a, tuple):
            n = sum(1 for x in a if x in adim)
            if n != 1:
                raise SenaryoHatasi("%s: %s alanlarından tam biri olmalı" % (yer, " / ".join(a)))
        elif a not in adim:
            raise SenaryoHatasi("%s: zorunlu alan yok: %s" % (yer, a))
    for a in ist:
        if isinstance(a, tuple) and sum(1 for x in a if x in adim) > 1:
            raise SenaryoHatasi("%s: %s alanlarından en çok biri olabilir" % (yer, " / ".join(a)))


def senaryo_dogrula(sen, dosya):
    """SENARYO-DILI §13: statik denetimler. Çalışma anında görülebilenler Model'de."""
    if not isinstance(sen, dict):
        raise SenaryoHatasi("senaryo bir JSON nesnesi olmalı")
    for k in sen:
        if k not in {"dil", "ad", "aciklama", "dayanak", "baslangic", "adimlar"}:
            raise SenaryoHatasi("üst düzeyde bilinmeyen alan: %r" % k)
    if sen.get("dil") != DIL:
        raise SenaryoHatasi("dil %r değil" % DIL)
    kok = os.path.basename(dosya)
    if kok.endswith(".json"):
        kok = kok[:-5]
    if sen.get("ad") != kok:
        raise SenaryoHatasi("ad (%r) dosya adıyla (%r) aynı değil" % (sen.get("ad"), kok))
    b = sen.get("baslangic")
    if not isinstance(b, dict):
        raise SenaryoHatasi("baslangic yok")
    for k in b:
        if k not in {"bugun", "sirket", "ayarlar", "kullanicilar"}:
            raise SenaryoHatasi("baslangic: bilinmeyen alan %r" % k)
    bugun = tarih_coz(b.get("bugun"), "baslangic.bugun")
    if b.get("sirket") != "bos":
        raise SenaryoHatasi('baslangic.sirket yalnız "bos" olabilir')
    ay = b.get("ayarlar", {})
    if not isinstance(ay, dict):
        raise SenaryoHatasi("baslangic.ayarlar nesne olmalı")
    for k, v in ay.items():
        if k == "kasaEksiBakiye":
            if v not in POLITIKALAR:
                raise SenaryoHatasi("kasaEksiBakiye geçersiz: %r" % v)
        elif k == "benzerIslemUyarisi":
            if v not in ("acik", "kapali"):
                raise SenaryoHatasi("benzerIslemUyarisi geçersiz: %r" % v)
        else:
            raise SenaryoHatasi("baslangic.ayarlar: bilinmeyen alan %r" % k)
    kul = b.get("kullanicilar", {"Y": "yonetici"})
    if not isinstance(kul, dict):
        raise SenaryoHatasi("kullanicilar nesne olmalı")
    if kul.get("Y", "yonetici") != "yonetici":
        raise SenaryoHatasi("Y her zaman yonetici")
    for k, v in kul.items():
        if not isinstance(k, str) or not k:
            raise SenaryoHatasi("kullanıcı takma adı geçersiz")
        if v not in ROLLER:
            raise SenaryoHatasi("rol geçersiz: %r" % v)
    roller = dict(kul)
    roller["Y"] = "yonetici"

    adimlar = sen.get("adimlar")
    if not isinstance(adimlar, list):
        raise SenaryoHatasi("adimlar liste olmalı")
    idler = set()
    adlar = {}            # takma ad → (tür, tanımlayan adım indeksi)
    tanim_adim = {}       # takma ad → adım sözlüğü (tanımlayan)
    gruplar = []          # [(ad, [indeksler])]
    kasa_pol = ay.get("kasaEksiBakiye")
    son_saat = bugun
    onceki_grup = None
    gorulen_gruplar = set()

    def ad_tanimla(a, tur, i, adim):
        if not isinstance(a, str) or not AD_RE.match(a):
            raise SenaryoHatasi("adım %d: takma ad biçimi geçersiz: %r" % (i, a))
        if a in adlar:
            raise SenaryoHatasi("adım %d: takma ad iki kez tanımlı: %s" % (i, a))
        adlar[a] = (tur, i)
        tanim_adim[a] = adim

    def ad_an(a, tur, i, alan):
        if not isinstance(a, str) or a not in adlar:
            raise SenaryoHatasi("adım %d: %s tanımsız takma ad: %r" % (i, alan, a))
        if adlar[a][0] != tur:
            raise SenaryoHatasi("adım %d: %s %s türünde değil (%s)" % (i, alan, tur, adlar[a][0]))
        return tanim_adim[a]

    for i, adim in enumerate(adimlar):
        if not isinstance(adim, dict):
            raise SenaryoHatasi("adım %d nesne değil" % i)
        aid = adim.get("id")
        if not isinstance(aid, str) or not ID_RE.match(aid) or aid in idler:
            raise SenaryoHatasi("adım %d: id geçersiz ya da tekrar: %r" % (i, aid))
        idler.add(aid)
        islem = adim.get("islem")
        if islem not in ALANLAR:
            raise SenaryoHatasi("adım %s: bilinmeyen islem %r" % (aid, islem))
        yer = "adım %s (%s)" % (aid, islem)
        _alan_denetle(adim, yer)
        k = adim.get("kullanici", "Y")
        if k not in roller:
            raise SenaryoHatasi("%s: kullanıcı tanımsız: %r" % (yer, k))
        for bayrak in ("benzerOnay", "yineDeKaydet"):
            if bayrak in adim and not isinstance(adim[bayrak], bool):
                raise SenaryoHatasi("%s: %s true/false olmalı" % (yer, bayrak))
        if "istekKimligi" in adim and (not isinstance(adim["istekKimligi"], str) or not adim["istekKimligi"]):
            raise SenaryoHatasi("%s: istekKimligi boş olmayan metin olmalı" % yer)
        if "tarih" in adim:
            tarih_coz(adim["tarih"], yer + ".tarih")
        # eşzamanlı grup
        g = adim.get("ayniAnda")
        if g is not None:
            if not isinstance(g, str) or not g:
                raise SenaryoHatasi("%s: ayniAnda metin olmalı" % yer)
            if islem == "kontrol":
                raise SenaryoHatasi("%s: grupta kontrol olmaz" % yer)
            if g == onceki_grup:
                gruplar[-1][1].append(i)
                if len(gruplar[-1][1]) > 4:
                    raise SenaryoHatasi("%s: grup en çok 4 adım" % yer)
            else:
                if g in gorulen_gruplar:
                    raise SenaryoHatasi("%s: ayniAnda grubu ardışık değil: %s" % (yer, g))
                gorulen_gruplar.add(g)
                gruplar.append((g, [i]))
        onceki_grup = g

        # anılan takma adlar
        refs = REFERANSLAR.get(islem, {})
        for alan, tur in refs.items():
            if alan in adim:
                ad_an(adim[alan], tur, i, "%s.%s" % (yer, alan))
        # işleme özgü statik kurallar
        if islem == "saat":
            yb = tarih_coz(adim["bugun"], yer + ".bugun")
            if yb < son_saat:
                raise SenaryoHatasi("%s: saat geri gidemez" % yer)
            son_saat = yb
        elif islem == "ayar":
            if not ("kasaEksiBakiye" in adim or "benzerIslemUyarisi" in adim):
                raise SenaryoHatasi("%s: ayar boş" % yer)
            if "kasaEksiBakiye" in adim:
                if adim["kasaEksiBakiye"] not in POLITIKALAR:
                    raise SenaryoHatasi("%s: kasaEksiBakiye geçersiz" % yer)
                kasa_pol = adim["kasaEksiBakiye"]
            if "benzerIslemUyarisi" in adim and adim["benzerIslemUyarisi"] not in ("acik", "kapali"):
                raise SenaryoHatasi("%s: benzerIslemUyarisi geçersiz" % yer)
        elif islem == "donem_kilidi":
            tarih_coz(adim["kilitTarihi"], yer + ".kilitTarihi")
        elif islem == "hesap_ac":
            if adim["tur"] not in HESAP_TURLERI:
                raise SenaryoHatasi("%s: hesap türü geçersiz" % yer)
            if adim["paraBirimi"] != "TRY":
                raise SenaryoHatasi("%s: yalnız TRY (döviz kapsam dışı)" % yer)
            for m in ("banka", "hesapAdi"):
                if not isinstance(adim[m], str) or not adim[m]:
                    raise SenaryoHatasi("%s: %s boş olamaz" % (yer, m))
            if "kod" in adim and (not isinstance(adim["kod"], str) or not adim["kod"]):
                raise SenaryoHatasi("%s: kod boş olamaz" % yer)
            if "iban" in adim:
                if adim["tur"] in ("kurumsal_kart", "kredi"):
                    raise SenaryoHatasi("%s: kart ve kredide IBAN verilmez" % yer)
                if not isinstance(adim["iban"], str) or adim["iban"] != adim["iban"].strip() \
                        or " " in adim["iban"] or adim["iban"] != adim["iban"].upper():
                    raise SenaryoHatasi("%s: IBAN boşluksuz ve büyük harfle yazılır (K-14)" % yer)
            if "kmhLimiti" in adim:
                if adim["tur"] not in KMH_TURLERI:
                    raise SenaryoHatasi("%s: KMH limiti yalnız vadesiz/ticari/diğer" % yer)
                tutar_coz(adim["kmhLimiti"], yer + ".kmhLimiti", sifir_olur=True)
            if "kartLimiti" in adim:
                if adim["tur"] != "kurumsal_kart":
                    raise SenaryoHatasi("%s: kart limiti yalnız kurumsal kartta" % yer)
                tutar_coz(adim["kartLimiti"], yer + ".kartLimiti", sifir_olur=True)
            tarih_coz(adim["acilisTarihi"], yer + ".acilisTarihi")
            if "acilisBakiyesi" in adim:
                tutar_coz(adim["acilisBakiyesi"], yer + ".acilisBakiyesi", sifir_olur=True,
                          eksi_olur=adim["tur"] in KMH_TURLERI)
            if "bakiyeDogrulandi" in adim and not isinstance(adim["bakiyeDogrulandi"], bool):
                raise SenaryoHatasi("%s: bakiyeDogrulandi true/false" % yer)
            if adim["tur"] == "kredi" and adim.get("bakiyeDogrulandi") is True:
                raise SenaryoHatasi("%s: BELİRSİZ-2 — kredi hesabı bakiyeDogrulandi:false açılır" % yer)
        elif islem == "hesap_durum":
            if adim["durum"] not in ("pasif", "aktif"):
                raise SenaryoHatasi("%s: durum pasif/aktif" % yer)
        elif islem == "hesap_eksi_politika":
            if adim["politika"] not in POLITIKALAR:
                raise SenaryoHatasi("%s: politika geçersiz" % yer)
            if tanim_adim[adim["hesap"]]["tur"] not in TUR_102 | {"kurumsal_kart"}:
                raise SenaryoHatasi("%s: politika yalnız 102 ya da 309 türü hesapta" % yer)
        elif islem == "acilis_duzelt":
            ht = tanim_adim[adim["hesap"]]["tur"]
            tarih_coz(adim["acilisTarihi"], yer + ".acilisTarihi")
            if "acilisBakiyesi" in adim:
                tutar_coz(adim["acilisBakiyesi"], yer + ".acilisBakiyesi", sifir_olur=True,
                          eksi_olur=ht in KMH_TURLERI)
            if "bakiyeDogrulandi" in adim and not isinstance(adim["bakiyeDogrulandi"], bool):
                raise SenaryoHatasi("%s: bakiyeDogrulandi true/false" % yer)
            if ht == "kredi" and adim.get("bakiyeDogrulandi") is True:
                raise SenaryoHatasi("%s: BELİRSİZ-2" % yer)
        elif islem == "kasa_acilis":
            tutar_coz(adim["tutar"], yer + ".tutar")
        elif islem == "kasa_hareket":
            if adim["yon"] not in ("giris", "cikis"):
                raise SenaryoHatasi("%s: yon giris/cikis" % yer)
            tutar_coz(adim["tutar"], yer + ".tutar")
            ac = adim["aciklama"]
            if not isinstance(ac, str) or not ac:
                raise SenaryoHatasi("%s: aciklama boş olamaz" % yer)
            kucuk = ac.replace("I", "ı").replace("İ", "i").lower()
            if "açılış" in kucuk or "acilis" in kucuk:
                raise SenaryoHatasi("%s: aciklamada 'açılış' geçmez (§4.9, plan A8)" % yer)
            if adim["yon"] == "cikis" and kasa_pol is None:
                raise SenaryoHatasi("%s: BELİRSİZ-1 — Kasa çıkışından önce kasaEksiBakiye verilmeli" % yer)
        elif islem == "cari_ac":
            if adim["tur"] not in ("musteri", "tedarikci"):
                raise SenaryoHatasi("%s: cari türü musteri/tedarikci" % yer)
            if not isinstance(adim["unvan"], str) or not adim["unvan"]:
                raise SenaryoHatasi("%s: unvan boş olamaz" % yer)
            if "iban" in adim and (not isinstance(adim["iban"], str) or not iban_gecerli(adim["iban"])):
                raise SenaryoHatasi("%s: cari IBAN'ı geçerli TR IBAN olmalı (K-14)" % yer)
        elif islem == "urun_ac":
            if adim["birim"] != "Adet":
                raise SenaryoHatasi('%s: birim yalnız "Adet"' % yer)
            if not isinstance(adim["urunAdi"], str) or not adim["urunAdi"]:
                raise SenaryoHatasi("%s: urunAdi boş olamaz" % yer)
        elif islem == "stok_giris":
            _miktar(adim["miktar"], yer)
        elif islem == "fatura":
            _fatura_statik(adim, yer, ad_an, i)
            if adim["tur"] == "alis" and kasa_pol is None and any(
                    p.get("yol") == "nakit" for p in (adim.get("odeme") or {}).get("pesin", [])):
                raise SenaryoHatasi("%s: BELİRSİZ-1 — Kasa çıkışından önce kasaEksiBakiye verilmeli" % yer)
        elif islem == "iade":
            asil = tanim_adim[adim["asilFatura"]]
            if asil.get("islem") != "fatura" and not (asil.get("islem") == "banka_masraf"):
                raise SenaryoHatasi("%s: iadenin iadesi yapılmaz" % yer)
            asil_tur = asil["tur"] if asil.get("islem") == "fatura" else "alis"
            if asil.get("islem") == "fatura" and (asil.get("odeme") or {}).get("taksit"):
                raise SenaryoHatasi("%s: BELİRSİZ-8 — taksitli faturanın iadesi kurulmaz" % yer)
            _iade_statik(adim, yer, asil)
            if "hesap" in adim["geri"]:
                ad_an(adim["geri"]["hesap"], "hesap", i, yer + ".geri.hesap")
            if asil_tur == "satis" and adim["geri"].get("yol") == "nakit" and kasa_pol is None:
                raise SenaryoHatasi("%s: BELİRSİZ-1" % yer)
        elif islem in ("cari_tahsilat", "cari_odeme"):
            yollar = ("nakit", "havale") if islem == "cari_tahsilat" else ("nakit", "havale", "kart")
            if adim["yol"] not in yollar:
                raise SenaryoHatasi("%s: yol geçersiz (kart yalnız ödemede; §13/7)" % yer)
            if adim["yol"] == "nakit" and "hesap" in adim:
                raise SenaryoHatasi("%s: nakitte hesap verilmez (§5.2/5)" % yer)
            if "tutar" in adim:
                tutar_coz(adim["tutar"], yer + ".tutar")
            if islem == "cari_odeme" and adim["yol"] == "nakit" and kasa_pol is None:
                raise SenaryoHatasi("%s: BELİRSİZ-1" % yer)
        elif islem == "taksit_tahsilat":
            if adim["yol"] not in ("nakit", "havale"):
                raise SenaryoHatasi("%s: yol nakit/havale" % yer)
            if adim["yol"] == "nakit" and "hesap" in adim:
                raise SenaryoHatasi("%s: nakitte hesap verilmez" % yer)
            tutar_coz(adim["tutar"], yer + ".tutar")
            if "taksitNo" in adim:
                _miktar(adim["taksitNo"], yer + ".taksitNo")
        elif islem == "kasa_banka":
            if adim["yon"] not in ("bankadan_kasaya", "kasadan_bankaya"):
                raise SenaryoHatasi("%s: yon geçersiz" % yer)
            tutar_coz(adim["tutar"], yer + ".tutar")
            if adim["yon"] == "kasadan_bankaya" and kasa_pol is None:
                raise SenaryoHatasi("%s: BELİRSİZ-1" % yer)
        elif islem == "transfer":
            if "tutar" in adim:
                tutar_coz(adim["tutar"], yer + ".tutar")
            ucretli = "ucret" in adim or "ucretHam" in adim
            if ucretli != ("ucretVergi" in adim):
                raise SenaryoHatasi("%s: ucret ile ucretVergi birlikte verilir (§13/8)" % yer)
            if "ucret" in adim:
                tutar_coz(adim["ucret"], yer + ".ucret")
            if "ucretVergi" in adim and adim["ucretVergi"] not in UCRET_VERGI:
                raise SenaryoHatasi("%s: ucretVergi geçersiz" % yer)
        elif islem == "banka_masraf":
            if adim["masrafTuru"] not in MASRAF_TURLERI:
                raise SenaryoHatasi("%s: masrafTuru geçersiz" % yer)
            if adim["vergi"] not in VERGI_KIPLERI:
                raise SenaryoHatasi("%s: vergi kipi geçersiz" % yer)
            if "tutar" in adim:
                tutar_coz(adim["tutar"], yer + ".tutar")
            kdv = adim["vergi"].startswith("kdv")
            if kdv:
                if "saglayici" not in adim or "fatura" not in adim:
                    raise SenaryoHatasi("%s: KDV kipinde saglayici ve fatura zorunlu (§13/8)" % yer)
                if tanim_adim[adim["saglayici"]]["tur"] != "tedarikci":
                    raise SenaryoHatasi("%s: sağlayıcı tedarikçi türü cari olmalı" % yer)
                if "kdvOrani" in adim and adim["kdvOrani"] not in (1, 10, 20):
                    raise SenaryoHatasi("%s: kdvOrani 1/10/20" % yer)
            elif any(x in adim for x in ("saglayici", "fatura", "kdvOrani")):
                raise SenaryoHatasi("%s: saglayici/fatura/kdvOrani yalnız KDV kipinde" % yer)
        elif islem == "faiz_geliri":
            if "brut" in adim:
                tutar_coz(adim["brut"], yer + ".brut")
            if oran_coz(adim["stopajOrani"], yer + ".stopajOrani") > 10000:
                raise SenaryoHatasi("%s: stopaj %100'ü aşamaz" % yer)
        elif islem in ("faiz_gideri", "diger_gelir", "diger_gider", "kart_borcu_odeme", "kredi_kullanim"):
            if "tutar" in adim:
                tutar_coz(adim["tutar"], yer + ".tutar")
        elif islem == "kredi_odeme":
            if "anapara" in adim:
                tutar_coz(adim["anapara"], yer + ".anapara")
            if "faiz" in adim:
                tutar_coz(adim["faiz"], yer + ".faiz")
        elif islem == "sil":
            h = tanim_adim[adim["hedef"]]
            # BELİRSİZ-1: Kasa'yı azaltan silme
            if kasa_pol is None and _kasa_arttiran(h):
                raise SenaryoHatasi("%s: BELİRSİZ-1 — Kasa'yı azaltan silmeden önce kasaEksiBakiye verilmeli" % yer)

        # takma ad tanımları
        for alan, tur in TANIMLAR.get(islem, {}).items():
            if alan in adim:
                ad_tanimla(adim[alan], tur, i, adim)
        if islem == "fatura" and (adim.get("odeme") or {}).get("taksit"):
            ad_tanimla(adim["odeme"]["taksit"].get("ad"), "kart", i, adim)
        if islem == "banka_masraf" and "fatura" in adim:
            ad_tanimla(adim["fatura"], "fatura", i, adim)

    # Grup içinde aynı grupta tanımlanan takma ad anılamaz
    for g, idx in gruplar:
        tanimli = set()
        for i in idx:
            adim = adimlar[i]
            for alan in REFERANSLAR.get(adim["islem"], {}):
                if adim.get(alan) in tanimli:
                    raise SenaryoHatasi("grup %s: aynı grupta tanımlanan takma ad anılamaz (%s)" % (g, adim[alan]))
            for alan in TANIMLAR.get(adim["islem"], {}):
                if alan in adim:
                    tanimli.add(adim[alan])
            if adim["islem"] == "fatura" and (adim.get("odeme") or {}).get("taksit"):
                tanimli.add(adim["odeme"]["taksit"]["ad"])
            if adim["islem"] == "banka_masraf" and "fatura" in adim:
                tanimli.add(adim["fatura"])
    return gruplar


def _kasa_arttiran(adim):
    i = adim.get("islem")
    if i in ("cari_tahsilat", "taksit_tahsilat"):
        return adim.get("yol") == "nakit"
    if i == "kasa_hareket":
        return adim.get("yon") == "giris"
    if i == "kasa_banka":
        return adim.get("yon") == "bankadan_kasaya"
    return False


def _miktar(v, yer):
    if not isinstance(v, int) or isinstance(v, bool) or v < 1:
        raise SenaryoHatasi("%s: miktar tamsayı ≥ 1 olmalı" % yer)
    return v


def _fatura_statik(adim, yer, ad_an, i):
    if adim["tur"] not in ("satis", "alis"):
        raise SenaryoHatasi("%s: fatura türü satis/alis" % yer)
    kal = adim["kalemler"]
    if not isinstance(kal, list) or not kal:
        raise SenaryoHatasi("%s: en az bir kalem" % yer)
    birlesim = set()
    for j, k in enumerate(kal):
        ky = "%s.kalemler[%d]" % (yer, j)
        if not isinstance(k, dict):
            raise SenaryoHatasi("%s nesne değil" % ky)
        izin = {"urun", "hizmet", "miktar", "birimFiyat", "birimFiyatHam", "kdvOrani", "kdvDahil",
                "iskontoOrani", "giderTuru"}
        for a in k:
            if a not in izin:
                raise SenaryoHatasi("%s: bilinmeyen alan %r" % (ky, a))
        if ("urun" in k) == ("hizmet" in k):
            raise SenaryoHatasi("%s: urun ya da hizmet (tam biri)" % ky)
        if "urun" in k:
            ad_an(k["urun"], "urun", i, ky + ".urun")
            if "giderTuru" in k:
                raise SenaryoHatasi("%s: stoklu kalemde giderTuru olmaz" % ky)
        else:
            if not isinstance(k["hizmet"], str) or not k["hizmet"]:
                raise SenaryoHatasi("%s: hizmet açıklaması boş" % ky)
            if adim["tur"] == "alis":
                if k.get("giderTuru") != "Banka Masrafları":
                    raise SenaryoHatasi('%s: alış hizmet kaleminde giderTuru "Banka Masrafları" zorunlu' % ky)
            elif "giderTuru" in k:
                raise SenaryoHatasi("%s: satışta giderTuru olmaz" % ky)
        q = _miktar(k.get("miktar"), ky + ".miktar")
        if ("birimFiyat" in k) == ("birimFiyatHam" in k):
            raise SenaryoHatasi("%s: birimFiyat ya da birimFiyatHam (tam biri)" % ky)
        if "birimFiyat" in k:
            tutar_coz(k["birimFiyat"], ky + ".birimFiyat")
        if k.get("kdvOrani") not in (1, 10, 20) or isinstance(k.get("kdvOrani"), bool):
            raise SenaryoHatasi("%s: kdvOrani 1/10/20" % ky)
        if not isinstance(k.get("kdvDahil"), bool):
            raise SenaryoHatasi("%s: kdvDahil true/false" % ky)
        if "iskontoOrani" in k:
            p = oran_coz(k["iskontoOrani"], ky + ".iskontoOrani")
            if p >= 10000:
                raise SenaryoHatasi("%s: iskonto %%100'den küçük olmalı" % ky)
            if p > 0 and q != 1:
                raise SenaryoHatasi("%s: BELİRSİZ-13 — iskontolu kalemde miktar 1" % ky)
        bk = (k["kdvOrani"], k["kdvDahil"])
        if bk in birlesim:
            raise SenaryoHatasi("%s: BELİRSİZ-12 — aynı (oran, dahil/hariç) için en çok bir kalem" % ky)
        birlesim.add(bk)
    od = adim.get("odeme")
    if od is None:
        return
    if not isinstance(od, dict):
        raise SenaryoHatasi("%s.odeme nesne değil" % yer)
    for a in od:
        if a not in ("pesin", "taksit"):
            raise SenaryoHatasi("%s.odeme: bilinmeyen alan %r" % (yer, a))
    pes = od.get("pesin", [])
    if not isinstance(pes, list) or len(pes) > 3:
        raise SenaryoHatasi("%s: pesin en çok 3 satır (§13/7)" % yer)
    tamami = 0
    for j, p in enumerate(pes):
        py = "%s.odeme.pesin[%d]" % (yer, j)
        if not isinstance(p, dict):
            raise SenaryoHatasi("%s nesne değil" % py)
        for a in p:
            if a not in ("yol", "tutar", "hesap"):
                raise SenaryoHatasi("%s: bilinmeyen alan %r" % (py, a))
        if p.get("yol") not in ("nakit", "havale", "kart"):
            raise SenaryoHatasi("%s: yol geçersiz" % py)
        if p["yol"] == "kart" and adim["tur"] != "alis":
            raise SenaryoHatasi("%s: kart yolu yalnız alışta (satışta POS kapsam dışı)" % py)
        if p["yol"] == "nakit" and "hesap" in p:
            raise SenaryoHatasi("%s: nakitte hesap verilmez" % py)
        if "hesap" in p:
            ad_an(p["hesap"], "hesap", i, py + ".hesap")
        if p.get("tutar") == "tamami":
            tamami += 1
        else:
            tutar_coz(p.get("tutar"), py + ".tutar")
    if tamami > 1:
        raise SenaryoHatasi("%s: en çok bir \"tamami\"" % yer)
    t = od.get("taksit")
    if t is not None:
        if adim["tur"] != "satis":
            raise SenaryoHatasi("%s: taksit yalnız satışta (§13/7)" % yer)
        if tamami:
            raise SenaryoHatasi('%s: "tamami" taksitle birlikte kullanılmaz' % yer)
        if not isinstance(t, dict):
            raise SenaryoHatasi("%s: taksit nesne değil" % yer)
        for a in t:
            if a not in ("ad", "sayi", "ilkVade"):
                raise SenaryoHatasi("%s.taksit: bilinmeyen alan %r" % (yer, a))
        _miktar(t.get("sayi"), yer + ".taksit.sayi")
        if "ilkVade" in t:
            tarih_coz(t["ilkVade"], yer + ".taksit.ilkVade")


def _iade_statik(adim, yer, asil):
    kal = adim["kalemler"]
    if not isinstance(kal, list) or not kal:
        raise SenaryoHatasi("%s: en az bir iade kalemi" % yer)
    asil_kalem_sayisi = len(asil["kalemler"]) if asil.get("islem") == "fatura" else 1
    gor = set()
    for j, k in enumerate(kal):
        ky = "%s.kalemler[%d]" % (yer, j)
        if not isinstance(k, dict) or set(k) != {"kalem", "miktar"}:
            raise SenaryoHatasi("%s: {kalem, miktar} olmalı" % ky)
        n = _miktar(k["kalem"], ky + ".kalem")
        if n > asil_kalem_sayisi:
            raise SenaryoHatasi("%s: asıl faturada %d. kalem yok" % (ky, n))
        if n in gor:
            raise SenaryoHatasi("%s: aynı kalem bir iadede iki kez (BELİRSİZ-12)" % ky)
        gor.add(n)
        _miktar(k["miktar"], ky + ".miktar")
    g = adim["geri"]
    if not isinstance(g, dict) or g.get("yol") not in ("acik", "nakit", "havale"):
        raise SenaryoHatasi("%s: geri.yol acik/nakit/havale" % yer)
    for a in g:
        if a not in ("yol", "hesap"):
            raise SenaryoHatasi("%s.geri: bilinmeyen alan %r" % (yer, a))
    if "hesap" in g and g["yol"] != "havale":
        raise SenaryoHatasi("%s: hesap yalnız havalede" % yer)


# --------------------------------------------------------------------------------------------
# Model
# --------------------------------------------------------------------------------------------

class Model:
    def __init__(self, sen):
        self.sen = sen
        b = sen["baslangic"]
        self.bugun = tarih_coz(b["bugun"], "bugun")
        ay = b.get("ayarlar", {})
        self.kasa_pol = ay.get("kasaEksiBakiye")
        self.benzer_acik = ay.get("benzerIslemUyarisi", "acik") == "acik"
        self.roller = dict(b.get("kullanicilar", {}))
        self.roller["Y"] = "yonetici"
        self.kilit = None
        self.v = {}                 # varlık anahtarı → sözlük
        self.ad = {}                # takma ad → varlık anahtarı
        self.ad_ilk = {}            # varlık anahtarı → ilk takma adı (çıktı adı)
        self.basarisiz = set()      # tanımı reddedilen/atlanan takma adlar
        self.sayac = defaultdict(int)
        self.alt_sayac = defaultdict(int)
        self.fisler = {}
        self.fis_no = 0
        self.hidx = defaultdict(dict)   # hesap kodu → {fiş: [(tarih, işaretli tutar)]}
        self.cidx = defaultdict(dict)   # cari anahtarı → {fiş: işaretli tutar}
        self.istekler = {}              # (kullanıcı, islem, kimlik) → (gövde, adım)
        self.benzer_idx = []            # {anahtar, hareket}
        self.belirsiz4 = []             # (tarih, tutar, {hesap anahtarları})
        self.retler = []
        self.yinelenenler = []
        self.atlananlar = []
        self.ara = {}
        self.ara_belirsiz = []
        self.seq = 0
        self.alis_urun = set()
        self.satis_urun = set()
        self.tipler = defaultdict(list)  # tip → [anahtar] (oluşma sırası)
        self.olusan = {}                 # adım id → {"ad"|"taksit"|"fatura": varlık anahtarı}
        self.odenen = defaultdict(int)   # taksit kartı → etkin tahsilat toplamı

    # ---------------- varlıklar ----------------
    def yeni_anahtar(self, tur):
        self.sayac[tur] += 1
        return "%s#%d" % (tur, self.sayac[tur])

    def varlik(self, alias):
        return self.v[self.ad[alias]]

    def anahtar(self, alias):
        return self.ad[alias]

    def ad_kaydet(self, alias, key):
        self.ad[alias] = key
        self.ad_ilk.setdefault(key, alias)

    def kaydet(self, adim, alan, key, obj, alias=None):
        """Varlığı deftere al; adımın oluşturduğu varlığı (yineleme için) ve takma adını kaydet."""
        self.v[key] = obj
        self.tipler[obj["tip"]].append(key)
        self.olusan.setdefault(adim["id"], {})[alan] = key
        if alias is not None:
            self.ad_kaydet(alias, key)

    def hesaplar(self):
        return [self.v[k] for k in self.tipler["hesap"]]

    def tip(self, tip):
        return [self.v[k] for k in self.tipler[tip]]

    # ---------------- defter ----------------
    def fis_ekle(self, tarih, satirlar, tur, adim):
        satirlar = [s for s in satirlar if s[1] or s[2]]
        if not satirlar:
            return None
        b = sum(s[1] for s in satirlar)
        a = sum(s[2] for s in satirlar)
        for s in satirlar:
            if s[1] < 0 or s[2] < 0 or (s[1] and s[2]):
                raise KahinHatasi("fiş satırı geçersiz: %r" % (s,))
        if b != a:
            raise KahinHatasi("fiş dengesiz (%s, adım %s): borç %d ≠ alacak %d" % (tur, adim, b, a))
        self.fis_no += 1
        fid = self.fis_no
        self.fisler[fid] = {"id": fid, "tarih": tarih, "satirlar": satirlar, "tur": tur, "adim": adim}
        for kod, bo, al, cari in satirlar:
            self.hidx[kod].setdefault(fid, []).append((tarih, bo - al))
            if cari is not None:
                self.cidx[cari][fid] = self.cidx[cari].get(fid, 0) + bo - al
        return fid

    def fis_sil(self, fid):
        f = self.fisler.pop(fid)
        for kod, _, _, cari in f["satirlar"]:
            self.hidx[kod].pop(fid, None)
            if cari is not None:
                self.cidx[cari].pop(fid, None)

    def bakiye(self, kod, kadar=None):
        t = 0
        for satirlar in self.hidx.get(kod, {}).values():
            for tarih, d in satirlar:
                if kadar is None or tarih <= kadar:
                    t += d
        return t

    def tarihler(self, kod):
        out = set()
        for satirlar in self.hidx.get(kod, {}).values():
            for tarih, _ in satirlar:
                out.add(tarih)
        return out

    def cari_bakiye(self, ckey):
        return sum(self.cidx.get(ckey, {}).values())

    # ---------------- ortak kurallar ----------------
    def tarih_denetle(self, t, ih):
        if t > self.bugun:
            ih.ekle(2, 400, None, None, "ileri tarih")
        if self.kilit is not None and t <= self.kilit:
            ih.ekle(4, 409, "period-locked", "CIKARIM", "kilitli tarih")

    def acilis_denetle(self, h, t, ih):
        if h is not None and t < h["acilis_tarihi"]:
            ih.ekle(4, "4xx", "bank-before-opening", "CIKARIM", "açılış öncesi")

    @staticmethod
    def uygun(h, kategori):
        if h["durum"] != "aktif":
            return False
        if kategori == "havale":
            return h["tur"] in HAVALE_UYGUN
        return h["tur"] == "kurumsal_kart"

    def hesap_sec(self, kategori, alias, ih):
        """SENARYO-DILI §5.2. Dönüş: hesap sözlüğü, None (hesapsız) ya da Dur."""
        uygunlar = [h for h in self.hesaplar() if self.uygun(h, kategori)]
        if alias is not None:
            h = self.varlik(alias)
            if not uygunlar or not self.uygun(h, kategori):
                ih.ekle(2, 400, "bank-account-invalid", "CIKARIM", "uygun olmayan hesap")
                raise Dur()
            return h
        if not uygunlar:
            return None
        if len(uygunlar) == 1:
            return uygunlar[0]
        ih.ekle(2, 400, "bank-account-required", "PLAN", "hesap seçilmedi")
        raise Dur()

    @staticmethod
    def para_hesabi(yol, h):
        if yol == "nakit":
            return "100"
        if h is not None:
            return h["gl"]
        return "102.00" if yol == "havale" else "108.00"

    def banka_hesabi_al(self, alias, izinli, ih):
        """Banka Fişi / transfer / kredi / kart borcu: açıkça verilen hesap; pasif ya da tür uygun değil → 400."""
        h = self.varlik(alias)
        if h["durum"] != "aktif" or h["tur"] not in izinli:
            ih.ekle(2, 400, "bank-account-invalid", "CIKARIM", "hesap uygun değil")
            raise Dur()
        return h

    def tutar_al(self, adim, alan, kip, ih, sifir_olur=False, eksi_olur=False):
        """Tutar ya da <alan>Ham. kip: 'banka' | 'modul' [SENARYO-DILI §6.2]."""
        if alan in adim:
            return tutar_coz(adim[alan], alan, sifir_olur=sifir_olur, eksi_olur=eksi_olur)
        ham = adim[alan + "Ham"]
        if not isinstance(ham, str):
            raise SenaryoHatasi("%sHam metin olmalı" % alan)
        m = HAM_RE.match(ham)
        if not m:
            raise SenaryoHatasi("%sHam: kâhinin çözemediği biçim %r (K-11)" % (alan, ham))
        eksi = m.group(1) == "-"
        tam = int(m.group(2))
        ond = m.group(3) or ""
        if len(ond) > 2:
            if kip == "banka":
                ih.ekle(2, 400, None, None, "2'den çok ondalık")
                raise Dur()
            n = len(ond)
            k = rh(tam * 10 ** n + int(ond), 10 ** (n - 2))
        else:
            k = tam * 100 + (int(ond) * 10 if len(ond) == 1 else (int(ond) if ond else 0))
        if eksi and k != 0 and not eksi_olur:
            ih.ekle(2, 400, None, None, "eksi tutar")
            raise Dur()
        if k == 0 and not sifir_olur:
            ih.ekle(2, 400, None, None, "sıfır tutar")
            raise Dur()
        if k > MAX_KURUS:
            ih.ekle(2, 400, None, None, "1e12 TL üstü")
            raise Dur()
        return -k if (eksi and k) else k

    def politika(self, kod):
        """Hesap kodunun etkin eksi bakiye politikası ve limiti; denetim yoksa (None, 0)."""
        if kod == "100":
            return self.kasa_pol, 0
        for h in self.hesaplar():
            if h["gl"] == kod:
                if h["tur"] == "kredi":
                    return None, 0
                if not h["dogrulandi"]:
                    return "kontrol_yok", 0
                p = h["politika"] or "uyar"
                lim = h["kmh"] if h["tur"] in KMH_TURLERI else (h["kart_limit"] if h["tur"] == "kurumsal_kart" else 0)
                return p, lim
        return None, 0   # 102.00 / 108.00 / gelir-gider hesapları

    def hesap_etkin_politika(self, h):
        if h["tur"] == "kredi" or not h["dogrulandi"]:
            return "kontrol_yok"
        return h["politika"] or "uyar"

    # ---------------- değişim uygulama ve denetim ----------------
    def deg_deltalar(self, deg):
        """Hesap kodu → [(tarih, işaretli tutar)] eklenecek; silinecek fişlerin satırları eksi."""
        out = defaultdict(list)
        for tarih, satirlar, _ in deg.yeni:
            for kod, bo, al, _c in satirlar:
                if bo or al:
                    out[kod].append((tarih, bo - al))
        for fid in deg.silinen:
            for kod, bo, al, _c in self.fisler[fid]["satirlar"]:
                out[kod].append((self.fisler[fid]["tarih"], -(bo - al)))
        return out

    def eksi_bakiye_denetle(self, deg, adim, rol, ih):
        """SENARYO-DILI §5.3 (K7). İşlemin azalttığı her hesap için yazımdan sonraki son durum."""
        deltalar = self.deg_deltalar(deg)
        ihlaller = []
        for kod in sorted(deltalar):
            net = sum(d for _, d in deltalar[kod])
            if net >= 0:
                continue
            pol, lim = self.politika(kod)
            if pol is None and kod == "100":
                raise SenaryoHatasi("adım %s: BELİRSİZ-1 — Kasa azalıyor, kasaEksiBakiye verilmemiş" % adim["id"])
            if pol is None or pol == "kontrol_yok":
                continue
            # azaltan satırların tarihi (silmede silinen satırın tarihi)
            d = min(t for t, x in deltalar[kod] if x < 0)
            ek = deltalar[kod]

            def B(kadar):
                return self.bakiye(kod, kadar) + sum(x for t, x in ek if kadar is None or t <= kadar)
            if kod == "100":
                # BELİRSİZ-20: formül Kasa için yazılı değil; üç okuma ayrışırsa senaryo geçersiz
                tum = B(None)
                tarihler = sorted({t for t in self.tarihler(kod) | {t for t, _ in ek} if t >= d})
                a = tum < 0
                b = min(B(d), tum) < 0
                c = min([B(t) for t in tarihler] + [tum]) < 0
                if len({a, b, c}) > 1:
                    raise SenaryoHatasi("adım %s: BELİRSİZ-20 — Kasa'da geriye tarihli azalış, okumalar ayrışıyor" % adim["id"])
                ihlal = a
            else:
                m = min(B(d), B(None)) + lim
                ihlal = m < 0
            if ihlal:
                ihlaller.append((kod, pol))
        if not ihlaller:
            return
        engelle = [k for k, p in ihlaller if p == "engelle"]
        uyar = [k for k, p in ihlaller if p == "uyar"]
        if engelle:
            ih.ekle(6, 409, "cash-blocked", "PLAN", "eksi bakiye (Engelle) %s" % ",".join(engelle))
        if uyar:
            if adim.get("yineDeKaydet") is True:
                if rol == "personel" and any(k != "100" for k in uyar):
                    raise SenaryoHatasi("adım %s: BELİRSİZ-18 — personelin banka Uyar'ını geçmesi" % adim["id"])
            else:
                ih.ekle(6, 409, "cash-negative", "CIKARIM", "eksi bakiye (Uyar) %s" % ",".join(uyar))

    def benzer_denetle(self, deg, adim, ih):
        """SENARYO-DILI §5.4 Benzer İşlem."""
        if deg.benzer is None:
            return
        anahtar = deg.benzer
        aktif = [e for e in self.benzer_idx if e["anahtar"] == anahtar and self._benzer_aktif(e)]
        silinmis = [e for e in self.benzer_idx if e["anahtar"] == anahtar and not self._benzer_aktif(e)]
        if not self.benzer_acik:
            return
        if adim.get("benzerOnay") is True:
            return
        if aktif:
            ih.ekle(5, 409, "bank-similar", "PLAN", "benzer işlem")
        elif silinmis:
            raise SenaryoHatasi("adım %s: BELİRSİZ-19 — silinmiş satırla aynı anahtar; benzerOnay:true yazılmalı" % adim["id"])

    def _benzer_aktif(self, e):
        if e["hareket"] is None:
            return True
        return self.v[e["hareket"]]["aktif"]

    def uygula(self, deg, adim):
        fids = []
        for fid in deg.silinen:
            self.fis_sil(fid)
        for tarih, satirlar, tur in deg.yeni:
            fids.append(self.fis_ekle(tarih, satirlar, tur, adim["id"]))
        for f in deg.uygula:
            f(fids)

    # ---------------- adım işleme ----------------
    def calistir(self, sira):
        adimlar = self.sen["adimlar"]
        for i in sira:
            self.adim_isle(i, adimlar[i])
        return self.cikti()

    def _referanslar(self, adim):
        out = []
        for alan in REFERANSLAR.get(adim["islem"], {}):
            if alan in adim:
                out.append(adim[alan])
        if adim["islem"] == "fatura":
            for k in adim["kalemler"]:
                if "urun" in k:
                    out.append(k["urun"])
            for p in (adim.get("odeme") or {}).get("pesin", []):
                if "hesap" in p:
                    out.append(p["hesap"])
        if adim["islem"] == "iade" and "hesap" in adim["geri"]:
            out.append(adim["geri"]["hesap"])
        return out

    def _tanimlar(self, adim):
        out = []
        for alan in TANIMLAR.get(adim["islem"], {}):
            if alan in adim:
                out.append(adim[alan])
        if adim["islem"] == "fatura" and (adim.get("odeme") or {}).get("taksit"):
            out.append(adim["odeme"]["taksit"]["ad"])
        if adim["islem"] == "banka_masraf" and "fatura" in adim:
            out.append(adim["fatura"])
        return out

    def adim_isle(self, i, adim):
        islem = adim["islem"]
        self.seq += 1
        if islem == "kontrol":
            self.ara[adim["id"]], bel = self.durum()
            for yol, neden in bel:
                self.ara_belirsiz.append({"alan": "araDurumlar.%s.%s" % (adim["id"], yol), "neden": neden})
            return
        if islem == "saat":
            self.bugun = tarih_coz(adim["bugun"], "saat")
            return
        # atlananlar: anılan takma ad reddedildiği için yok [§8.5]
        if any(r in self.basarisiz for r in self._referanslar(adim)):
            self.atlananlar.append(i)
            self.basarisiz.update(self._tanimlar(adim))
            return
        kul = adim.get("kullanici", "Y")
        rol = self.roller[kul]
        tarih = tarih_coz(adim["tarih"], "tarih") if "tarih" in adim else self.bugun
        # 1) yetki
        y = self.yetki(adim, rol, kul)
        if y == "B":
            raise SenaryoHatasi("adım %s: BELİRSİZ-18 — %s rolünde %s planda tanımsız" % (adim["id"], rol, islem))
        if y == 403:
            self.ret(i, adim, [(1, 0, 403, None, None, "yetki")])
            return
        ih = Ihlaller()
        deg = None
        try:
            deg = getattr(self, "_i_" + islem)(adim, tarih, ih, rol, kul)
        except Dur:
            deg = None
        if 2 in ih.gruplar():
            self.ret(i, adim, ih.liste)
            return
        # 3) istek kimliği
        if "istekKimligi" in adim:
            anahtar = (kul, islem, adim["istekKimligi"])
            govde = self.govde(adim, tarih)
            if anahtar in self.istekler:
                eski_govde, eski_adim = self.istekler[anahtar]
                if eski_govde == govde:
                    self.yinelenenler.append(i)
                    self._yineleme_adlari(adim, eski_adim)
                    return
                self.ret(i, adim, [(3, 0, 409, None, None, "aynı kimlik, farklı gövde")])
                return
        # 4–6
        if deg is not None:
            self.benzer_denetle(deg, adim, ih)
            if deg.eksi_denetimi:
                self.eksi_bakiye_denetle(deg, adim, rol, ih)
        if ih:
            self.ret(i, adim, ih.liste)
            return
        if deg is None:
            raise KahinHatasi("adım %s: ihlalsiz ama değişim yok" % adim["id"])
        self.uygula(deg, adim)
        if "istekKimligi" in adim:
            self.istekler[(kul, islem, adim["istekKimligi"])] = (self.govde(adim, tarih), adim)

    def ret(self, i, adim, liste):
        self.basarisiz.update(self._tanimlar(adim))
        cesit = []
        for g, _, durum, kod, day, neden in sorted(liste):
            if (durum, kod) not in [(d, k) for d, k, _ in cesit]:
                cesit.append((durum, kod, day))
        if len(cesit) == 1:
            d, k, day = cesit[0]
            self.retler.append((i, {"adim": adim["id"], "durum": d, "kod": k, "kodDayanak": day}))
        else:
            # BELİRSİZ-17: birden çok ihlal → yalnız 4xx sınıfı karşılaştırılır
            self.retler.append((i, {"adim": adim["id"], "durum": "4xx", "kod": None, "kodDayanak": None,
                                    "_birden_cok": [[d, k] for d, k, _ in cesit]}))

    def govde(self, adim, tarih):
        g = {k: v for k, v in adim.items() if k not in GOVDE_DISI}
        g["kullanici"] = adim.get("kullanici", "Y")
        if adim["islem"] in TARIHLI:
            g["tarih"] = tarih_yaz(tarih)
        if adim["islem"] == "fatura" and (g.get("odeme") or {}).get("taksit"):
            g["odeme"] = dict(g["odeme"])
            g["odeme"]["taksit"] = {k: v for k, v in g["odeme"]["taksit"].items() if k != "ad"}
        if adim["islem"] == "banka_masraf":
            g.pop("fatura", None)

        def coz(x, ust=None):
            if isinstance(x, dict):
                return {k: coz(v, k) for k, v in x.items()}
            if isinstance(x, list):
                return [coz(v, ust) for v in x]
            if isinstance(x, str) and ust in REF_ANAHTARLARI and x in self.ad:
                return "#" + self.ad[x]
            return x
        return json.dumps(coz(g), sort_keys=True, ensure_ascii=False)

    def _yineleme_adlari(self, adim, eski):
        """Yinelenen adımın tanımladığı takma adlar önceki adımın varlıklarını anar [§5.4]."""
        olusan = self.olusan.get(eski["id"], {})
        ciftler = []
        if "ad" in adim and adim["islem"] in TANIMLAR:
            ciftler.append(("ad", adim["ad"]))
        if adim["islem"] == "fatura" and (adim.get("odeme") or {}).get("taksit"):
            ciftler.append(("taksit", adim["odeme"]["taksit"]["ad"]))
        if adim["islem"] == "banka_masraf" and "fatura" in adim:
            ciftler.append(("fatura", adim["fatura"]))
        for alan, alias in ciftler:
            if alan in olusan:
                self.ad_kaydet(alias, olusan[alan])
            else:
                self.basarisiz.add(alias)

    # ---------------- yetki (§5.5) ----------------
    def yetki(self, adim, rol, kul):
        islem = adim["islem"]
        if rol == "yonetici":
            return 200
        if islem in ("ayar", "donem_kilidi", "kasa_acilis", "kasa_hareket", "cari_ac", "urun_ac",
                     "stok_giris", "fatura", "iade"):
            return "B"
        if islem in ("hesap_ac", "hesap_durum", "hesap_eksi_politika", "acilis_duzelt", "transfer",
                     "kredi_kullanim", "kredi_odeme", "ters_kayit"):
            return 200 if rol == "muhasebe" else 403
        if islem in ("cari_tahsilat", "taksit_tahsilat"):
            return 200
        if islem == "cari_odeme":
            if adim["yol"] == "nakit":
                return "B"
            return 200 if rol == "muhasebe" else 403
        if islem == "kasa_banka":
            return "B" if rol == "muhasebe" else 403
        if islem == "banka_masraf":
            if adim["vergi"].startswith("kdv"):
                return "B" if rol == "muhasebe" else 403
            return 200 if rol == "muhasebe" else 403
        if islem in ("faiz_geliri", "faiz_gideri", "diger_gelir", "diger_gider", "kart_borcu_odeme"):
            return 200 if rol == "muhasebe" else 403
        if islem == "sil":
            h = self.varlik(adim["hedef"])
            if h["hesaba_bagli"] or h["islem"] in BANKA_FISI | {"transfer", "ters_kayit"}:
                return "B" if rol == "muhasebe" else 403
            if rol == "muhasebe":
                return "B"
            return 200 if h["kullanici"] == kul else "B"
        raise KahinHatasi("yetki: bilinmeyen işlem %s" % islem)

    # ---------------- işlemler ----------------
    def _i_ayar(self, adim, tarih, ih, rol, kul):
        deg = Degisim()

        def f(_):
            if "kasaEksiBakiye" in adim:
                self.kasa_pol = adim["kasaEksiBakiye"]
            if "benzerIslemUyarisi" in adim:
                self.benzer_acik = adim["benzerIslemUyarisi"] == "acik"
        deg.uygula.append(f)
        return deg

    def _i_donem_kilidi(self, adim, tarih, ih, rol, kul):
        k = tarih_coz(adim["kilitTarihi"], "kilitTarihi")
        if k > self.bugun:
            raise SenaryoHatasi("adım %s: kilit tarihi bugünden sonra olamaz [YAYGIN]" % adim["id"])
        if self.kilit is not None and k < self.kilit:
            raise SenaryoHatasi("adım %s: kilit geri alınmaz (bu dil sürümünde)" % adim["id"])
        deg = Degisim()

        def f(_):
            self.kilit = k
        deg.uygula.append(f)
        return deg

    def _i_hesap_ac(self, adim, tarih, ih, rol, kul):
        tur = adim["tur"]
        D = tarih_coz(adim["acilisTarihi"], "acilisTarihi")
        if D > self.bugun:
            ih.ekle(2, 400, None, None, "açılış ileri tarih")
        if self.kilit is not None and D <= self.kilit:
            ih.ekle(4, 409, "period-locked", "CIKARIM", "açılış kilitli")
        if "iban" in adim and not iban_gecerli(adim["iban"]):
            ih.ekle(2, 400, None, None, "geçersiz IBAN")
        S = None
        try:
            S = self.tutar_al(adim, "acilisBakiyesi", "banka", ih, sifir_olur=True,
                              eksi_olur=tur in KMH_TURLERI)
        except Dur:
            pass
        for h in self.hesaplar():
            if "iban" in adim and h["iban"] == adim["iban"]:
                ih.ekle(4, 409, None, None, "aynı IBAN")
            if "kod" in adim and h["kod"] is not None:
                if h["kod"] == adim["kod"]:
                    ih.ekle(4, "4xx", None, None, "aynı hesap kodu")
                elif h["kod"].casefold() == adim["kod"].casefold():
                    raise SenaryoHatasi("adım %s: yalnız büyük/küçük harfle ayrışan hesap kodu (K-14)" % adim["id"])
        if S is None:
            return None
        dog = adim.get("bakiyeDogrulandi", False)
        kmh = tutar_coz(adim.get("kmhLimiti", "0"), "kmhLimiti", sifir_olur=True)
        kl = tutar_coz(adim.get("kartLimiti", "0"), "kartLimiti", sifir_olur=True)
        ana = ANA_KOD[tur]
        nn = self.alt_sayac[ana] + 1
        if nn > 99:
            raise SenaryoHatasi("99'dan çok alt hesap")
        gl = "%s.%02d" % (ana, nn)
        deg = Degisim()
        satirlar = self.acilis_satirlari(ana, gl, S)
        if satirlar:
            deg.yeni.append((D, satirlar, "acilis"))
        deg.eksi_denetimi = False
        key = self.yeni_anahtar("hesap")
        h = {"tip": "hesap", "key": key, "tur": tur, "gl": gl, "kod": adim.get("kod"), "iban": adim.get("iban"),
             "acilis_tarihi": D, "acilis": S, "dogrulandi": dog, "kmh": kmh, "kart_limit": kl,
             "durum": "aktif", "politika": None, "acilis_fis": None}
        # Açılış eksi bakiye denetimine girmez; girseydi ihlal olacaksa kâhin karar vermez (K-6)
        if satirlar and dog and tur != "kredi":
            lim = kmh if tur in KMH_TURLERI else (kl if tur == "kurumsal_kart" else 0)
            delta = sum(s[1] - s[2] for s in satirlar if s[0] == gl)
            if delta < 0 and delta + lim < 0:
                raise SenaryoHatasi("adım %s: K-6 — eksi açılış limiti aşıyor (açılışa denetim tanımsız)" % adim["id"])

        def f(fids):
            self.alt_sayac[ana] = nn
            h["acilis_fis"] = fids[0] if fids else None
            self.kaydet(adim, "ad", key, h, adim["ad"])
        deg.uygula.append(f)
        return deg

    @staticmethod
    def acilis_satirlari(ana, gl, S):
        if S == 0:
            return []
        if ana == "102":
            if S > 0:
                return [(gl, S, 0, None), ("500", 0, S, None)]
            return [("500", -S, 0, None), (gl, 0, -S, None)]
        return [("500", S, 0, None), (gl, 0, S, None)]

    def _i_hesap_durum(self, adim, tarih, ih, rol, kul):
        h = self.varlik(adim["hesap"])
        deg = Degisim()
        deg.uygula.append(lambda _: h.__setitem__("durum", adim["durum"]))
        return deg

    def _i_hesap_eksi_politika(self, adim, tarih, ih, rol, kul):
        h = self.varlik(adim["hesap"])
        if not h["dogrulandi"]:
            raise SenaryoHatasi("adım %s: BELİRSİZ-3 — politika yalnız doğrulanmış hesapta" % adim["id"])
        deg = Degisim()
        deg.uygula.append(lambda _: h.__setitem__("politika", adim["politika"]))
        return deg

    def _ilk_hareket(self, h):
        tarihler = []
        for fid, satirlar in self.hidx.get(h["gl"], {}).items():
            if fid == h["acilis_fis"]:
                continue
            tarihler.extend(t for t, _ in satirlar)
        return min(tarihler) if tarihler else None

    def _i_acilis_duzelt(self, adim, tarih, ih, rol, kul):
        h = self.varlik(adim["hesap"])
        if h["durum"] != "aktif":
            raise SenaryoHatasi("adım %s: K-13 — pasif hesapta Açılışı Düzelt planda tanımsız" % adim["id"])
        D2 = tarih_coz(adim["acilisTarihi"], "acilisTarihi")
        if D2 > self.bugun:
            ih.ekle(2, 400, None, None, "açılış ileri tarih")
        S2 = None
        try:
            S2 = self.tutar_al(adim, "acilisBakiyesi", "banka", ih, sifir_olur=True,
                               eksi_olur=h["tur"] in KMH_TURLERI)
        except Dur:
            pass
        if self.kilit is not None and h["acilis_tarihi"] <= self.kilit:
            ih.ekle(4, 409, None, None, "kilitli açılış düzeltilmez")
        if self.kilit is not None and D2 <= self.kilit:
            ih.ekle(4, 409, "period-locked", "CIKARIM", "yeni açılış kilitli")
        ilk = self._ilk_hareket(h)
        if ilk is not None and D2 > ilk:
            ih.ekle(4, 409, "bank-opening-after-first", "PLAN", "açılış ilk hareketten sonra")
        if S2 is None:
            return None
        ana = h["gl"].split(".")[0]
        deg = Degisim()
        if h["acilis_fis"] is not None:
            deg.silinen.append(h["acilis_fis"])
        satirlar = self.acilis_satirlari(ana, h["gl"], S2)
        if satirlar:
            deg.yeni.append((D2, satirlar, "acilis"))
        dog = adim.get("bakiyeDogrulandi", h["dogrulandi"])
        deg.eksi_denetimi = False
        # K-6: açılış düzeltmesi eksi bakiye denetimine girmez; girseydi sonucu değişecekse karar verilmez
        if dog and h["tur"] != "kredi":
            lim = h["kmh"] if h["tur"] in KMH_TURLERI else (h["kart_limit"] if h["tur"] == "kurumsal_kart" else 0)
            deltalar = self.deg_deltalar(deg)
            ek = deltalar.get(h["gl"], [])
            if sum(x for _, x in ek) < 0:
                tum = self.bakiye(h["gl"]) + sum(x for _, x in ek)
                dmin = min(t for t, x in ek if x < 0)
                gun = self.bakiye(h["gl"], dmin) + sum(x for t, x in ek if t <= dmin)
                if min(tum, gun) + lim < 0:
                    raise SenaryoHatasi("adım %s: K-6 — açılış düzeltmesi bakiyeyi limit altına indiriyor" % adim["id"])

        def f(fids):
            h["acilis_tarihi"] = D2
            h["acilis"] = S2
            h["acilis_fis"] = fids[0] if fids else None
            h["dogrulandi"] = dog
        deg.uygula.append(f)
        return deg

    def _i_kasa_acilis(self, adim, tarih, ih, rol, kul):
        T = tutar_coz(adim["tutar"], "tutar")
        self.tarih_denetle(tarih, ih)
        deg = Degisim()
        deg.yeni.append((tarih, [("100", T, 0, None), ("500", 0, T, None)], "kasa_acilis"))
        return deg

    def _hareket(self, adim, islem, kul, tarih, **ek):
        key = self.yeni_anahtar("hareket")
        h = {"tip": "hareket", "key": key, "islem": islem, "adim": adim["id"], "kullanici": kul,
             "tarih": tarih, "aktif": True, "ters": False, "fisler": [], "hesaba_bagli": False,
             "hesaplar": set()}
        h.update(ek)
        return key, h

    def _hareket_kaydet(self, deg, adim, key, h):
        def f(fids):
            h["fisler"] = [x for x in fids if x is not None]
            self.kaydet(adim, "ad", key, h, adim.get("ad"))
        deg.uygula.append(f)

    def _i_kasa_hareket(self, adim, tarih, ih, rol, kul):
        T = tutar_coz(adim["tutar"], "tutar")
        self.tarih_denetle(tarih, ih)
        deg = Degisim()
        if adim["yon"] == "giris":
            s = [("100", T, 0, None), ("649", 0, T, None)]
        else:
            s = [("770", T, 0, None), ("100", 0, T, None)]
        deg.yeni.append((tarih, s, "kasa_hareket"))
        key, h = self._hareket(adim, "kasa_hareket", kul, tarih, tutar=T, yol="nakit")
        self._hareket_kaydet(deg, adim, key, h)
        return deg

    def _i_cari_ac(self, adim, tarih, ih, rol, kul):
        deg = Degisim()
        key = self.yeni_anahtar("cari")
        c = {"tip": "cari", "key": key, "tur": adim["tur"], "gl": "120" if adim["tur"] == "musteri" else "320",
             "unvan": adim["unvan"]}

        def f(_):
            self.kaydet(adim, "ad", key, c, adim["ad"])
        deg.uygula.append(f)
        return deg

    def _i_urun_ac(self, adim, tarih, ih, rol, kul):
        deg = Degisim()
        key = self.yeni_anahtar("urun")
        u = {"tip": "urun", "key": key, "miktar": 0}

        def f(_):
            self.kaydet(adim, "ad", key, u, adim["ad"])
        deg.uygula.append(f)
        return deg

    def _i_stok_giris(self, adim, tarih, ih, rol, kul):
        u = self.varlik(adim["urun"])
        q = adim["miktar"]
        deg = Degisim()
        deg.uygula.append(lambda _: u.__setitem__("miktar", u["miktar"] + q))
        return deg

    # ---- fatura ----
    def _kalemleri_hesapla(self, kalemler, ih):
        out = []
        for k in kalemler:
            if "birimFiyat" in k:
                f = tutar_coz(k["birimFiyat"], "birimFiyat")
            else:
                f = self.tutar_al(k, "birimFiyat", "modul", ih)
            p = oran_coz(k["iskontoOrani"], "iskontoOrani") if "iskontoOrani" in k else 0
            m, kd, t = kalem_hesapla(k["miktar"], f, k["kdvOrani"], k["kdvDahil"], p)
            out.append({"urun": self.anahtar(k["urun"]) if "urun" in k else None, "miktar": k["miktar"],
                        "f": f, "r": k["kdvOrani"], "dahil": k["kdvDahil"], "p": p,
                        "M": m, "K": kd, "T": t, "gider": "770" if "hizmet" in k else None})
        return out

    def _stok_denetle(self, degisimler, adim):
        """BELİRSİZ-14: stok eksiye düşmez."""
        net = defaultdict(int)
        for ukey, d in degisimler:
            net[ukey] += d
        for ukey, d in net.items():
            if self.v[ukey]["miktar"] + d < 0:
                raise SenaryoHatasi("adım %s: BELİRSİZ-14 — stok eksiye düşüyor" % adim["id"])

    def _i_fatura(self, adim, tarih, ih, rol, kul):
        return self._fatura_yaz(adim, tarih, ih, adim["tur"], self.varlik(adim["cari"]), adim["kalemler"],
                                adim.get("odeme") or {}, adim["ad"], masraf=False)

    def _fatura_yaz(self, adim, tarih, ih, tur, cari, kalemler, odeme, fatura_ad, masraf):
        self.tarih_denetle(tarih, ih)
        kal = self._kalemleri_hesapla(kalemler, ih)
        T = sum(k["T"] for k in kal)
        M = sum(k["M"] for k in kal)
        K = sum(k["K"] for k in kal)
        c = cari["gl"]
        pesinler = []    # (yol, hesap|None, tutar)
        tamami_var = False
        for p in odeme.get("pesin", []):
            yol = p["yol"]
            h = None
            if yol != "nakit":
                h = self.hesap_sec("havale" if yol == "havale" else "kart", p.get("hesap"), ih)
            if p["tutar"] == "tamami":
                tamami_var = True
                pesinler.append([yol, h, None])
            else:
                pesinler.append([yol, h, tutar_coz(p["tutar"], "pesin.tutar")])
        diger = sum(x[2] for x in pesinler if x[2] is not None)
        if tamami_var:
            kalan = T - diger
            if kalan <= 0:
                if kalan < 0:
                    ih.ekle(2, "4xx", None, None, "Σ peşin > toplam")
                    raise Dur()
                raise SenaryoHatasi("adım %s: \"tamami\" sıfır tutar veriyor" % adim["id"])
            for x in pesinler:
                if x[2] is None:
                    x[2] = kalan
        P = sum(x[2] for x in pesinler)
        if P > T:
            ih.ekle(2, "4xx", None, None, "Σ peşin > toplam")
            raise Dur()
        for yol, h, _t in pesinler:
            self.acilis_denetle(h, tarih, ih)
        taksit = odeme.get("taksit")
        if taksit and T - P <= 0:
            raise SenaryoHatasi("adım %s: taksit kartı toplamı sıfır olamaz" % adim["id"])
        # stok
        stok = []
        for k in kal:
            if k["urun"] is not None:
                stok.append((k["urun"], -k["miktar"] if tur == "satis" else k["miktar"]))
        self._stok_denetle(stok, adim)
        deg = Degisim()
        if tur == "satis":
            fs = [(c, T, 0, cari["key"]), ("600", 0, M, None), ("391", 0, K, None)]
        else:
            m153 = sum(k["M"] for k in kal if k["urun"] is not None)
            m770 = sum(k["M"] for k in kal if k["urun"] is None)
            fs = [("153", m153, 0, None), ("770", m770, 0, None), ("191", K, 0, None), (c, 0, T, cari["key"])]
        deg.yeni.append((tarih, fs, "fatura"))
        fkey = self.yeni_anahtar("fatura")
        benzer_kayitlari = []
        for yol, h, tt in pesinler:
            ph = self.para_hesabi(yol, h)
            if tur == "satis":
                deg.yeni.append((tarih, [(ph, tt, 0, None), (c, 0, tt, cari["key"])], "pesin"))
            else:
                deg.yeni.append((tarih, [(c, tt, 0, cari["key"]), (ph, 0, tt, None)], "pesin"))
            if h is not None:
                benzer_kayitlari.append(("giris" if tur == "satis" else "cikis", yol, h["key"], cari["key"],
                                         tt, tarih, ("fatura", fkey)))
        kkey = self.yeni_anahtar("kart") if taksit else None
        belge = {"tip": "fatura", "key": fkey, "tur": tur, "masraf": masraf, "cari": cari["key"], "tarih": tarih,
                 "seq": self.seq, "kalemler": kal, "T": T, "M": M, "K": K, "pesin": P, "kart": kkey,
                 "asil": None, "geri": None, "iade_miktar": defaultdict(int)}

        def f(fids):
            self.kaydet(adim, "ad", fkey, belge, fatura_ad)
            for ukey, d in stok:
                self.v[ukey]["miktar"] += d
                (self.satis_urun if tur == "satis" else self.alis_urun).add(ukey)
            for b in benzer_kayitlari:
                self.benzer_idx.append({"anahtar": b, "hareket": None})
            if taksit:
                self.kaydet(adim, "taksit", kkey,
                            {"tip": "kart", "key": kkey, "fatura": fkey, "cari": cari["key"], "toplam": T - P,
                             "sayi": taksit["sayi"], "tarih": tarih}, taksit["ad"])
        deg.uygula.append(f)
        return deg

    def _i_iade(self, adim, tarih, ih, rol, kul):
        asil = self.varlik(adim["asilFatura"])
        if asil["asil"] is not None:
            raise SenaryoHatasi("adım %s: iadenin iadesi yapılmaz" % adim["id"])
        if asil["kart"] is not None:
            raise SenaryoHatasi("adım %s: BELİRSİZ-8" % adim["id"])
        self.tarih_denetle(tarih, ih)
        if tarih < asil["tarih"]:
            ih.ekle(4, "4xx", None, None, "iade tarihi asıldan önce")
        cari = self.v[asil["cari"]]
        c = cari["gl"]
        satis = asil["tur"] == "satis"
        kal = []
        for k in adim["kalemler"]:
            n = k["kalem"]
            if n > len(asil["kalemler"]):
                raise SenaryoHatasi("adım %s: asıl faturada %d. kalem yok" % (adim["id"], n))
            ak = asil["kalemler"][n - 1]
            q = k["miktar"]
            if asil["iade_miktar"][n] + q > ak["miktar"]:
                ih.ekle(4, "4xx", None, None, "iade miktarı aşıyor")
            m, kd, t = kalem_hesapla(q, ak["f"], ak["r"], ak["dahil"], ak["p"])
            kal.append({"n": n, "urun": ak["urun"], "miktar": q, "M": m, "K": kd, "T": t, "gider": ak["gider"],
                        "f": ak["f"], "r": ak["r"], "dahil": ak["dahil"], "p": ak["p"]})
        T = sum(k["T"] for k in kal)
        M = sum(k["M"] for k in kal)
        K = sum(k["K"] for k in kal)
        geri = adim["geri"]
        h = None
        if geri["yol"] == "havale":
            h = self.hesap_sec("havale", geri.get("hesap"), ih)
            self.acilis_denetle(h, tarih, ih)
        stok = [(k["urun"], k["miktar"] if satis else -k["miktar"]) for k in kal if k["urun"] is not None]
        self._stok_denetle(stok, adim)
        deg = Degisim()
        if satis:
            fs = [("610", M, 0, None), ("391", K, 0, None), (c, 0, T, cari["key"])]
        else:
            m153 = sum(k["M"] for k in kal if k["urun"] is not None)
            m770 = sum(k["M"] for k in kal if k["urun"] is None)
            fs = [(c, T, 0, cari["key"]), ("153", 0, m153, None), ("770", 0, m770, None), ("191", 0, K, None)]
        deg.yeni.append((tarih, fs, "iade"))
        ikey = self.yeni_anahtar("fatura")
        benzer = []
        if geri["yol"] != "acik":
            ph = self.para_hesabi(geri["yol"], h)
            if satis:
                deg.yeni.append((tarih, [(c, T, 0, cari["key"]), (ph, 0, T, None)], "iade_geri"))
            else:
                deg.yeni.append((tarih, [(ph, T, 0, None), (c, 0, T, cari["key"])], "iade_geri"))
            if h is not None:
                benzer.append(("cikis" if satis else "giris", "havale", h["key"], cari["key"], T, tarih,
                               ("fatura", ikey)))
        belge = {"tip": "fatura", "key": ikey, "tur": "satis_iade" if satis else "alis_iade", "masraf": False,
                 "cari": cari["key"], "tarih": tarih, "seq": self.seq, "kalemler": kal, "T": T, "M": M, "K": K,
                 "pesin": 0, "kart": None, "asil": asil["key"], "geri": geri["yol"],
                 "iade_miktar": defaultdict(int)}

        def f(fids):
            self.kaydet(adim, "ad", ikey, belge, adim["ad"])
            for k in kal:
                asil["iade_miktar"][k["n"]] += k["miktar"]
            for ukey, d in stok:
                self.v[ukey]["miktar"] += d
            for b in benzer:
                self.benzer_idx.append({"anahtar": b, "hareket": None})
        deg.uygula.append(f)
        return deg

    # ---- cari ----
    def _hafta_sonu(self, adim, tarih, h):
        if h is not None and tarih.weekday() >= 5:
            raise SenaryoHatasi("adım %s: BELİRSİZ-5 — hesaba bağlı tahsilat/ödeme hafta içi tarihle" % adim["id"])

    def _i_cari_tahsilat(self, adim, tarih, ih, rol, kul):
        return self._cari_hareket(adim, tarih, ih, kul, "giris")

    def _i_cari_odeme(self, adim, tarih, ih, rol, kul):
        return self._cari_hareket(adim, tarih, ih, kul, "cikis")

    def _cari_hareket(self, adim, tarih, ih, kul, yon):
        cari = self.varlik(adim["cari"])
        yol = adim["yol"]
        T = None
        try:
            T = self.tutar_al(adim, "tutar", "modul", ih)
        except Dur:
            pass
        self.tarih_denetle(tarih, ih)
        h = None
        if yol != "nakit":
            h = self.hesap_sec("havale" if yol == "havale" else "kart", adim.get("hesap"), ih)
            self.acilis_denetle(h, tarih, ih)
        if T is None:
            raise Dur()
        self._hafta_sonu(adim, tarih, h)
        kf = None
        if "kapatilacakFatura" in adim:
            b = self.varlik(adim["kapatilacakFatura"])
            if b["cari"] != cari["key"]:
                raise SenaryoHatasi("adım %s: kapatılacak fatura başka carinin" % adim["id"])
            alacak_belgesi = b["tur"] in ("satis", "alis_iade")
            if yon == "giris" and not alacak_belgesi or yon == "cikis" and alacak_belgesi:
                raise SenaryoHatasi("adım %s: kapatılacak belge türü yön ile uyuşmuyor" % adim["id"])
            if b["kart"] is not None:
                raise SenaryoHatasi("adım %s: kapatılacak fatura taksitli olamaz" % adim["id"])
            if tarih < b["tarih"]:
                raise SenaryoHatasi("adım %s: K-12 — belgeden önce tarihli bağlı ödeme planda tanımsız" % adim["id"])
            acik, _bel, _dg = self.aciklar()
            if T > acik[b["key"]]:
                raise SenaryoHatasi("adım %s: BELİRSİZ-10 — bağlı tutar belgenin açığını aşıyor" % adim["id"])
            kf = b["key"]
        ph = self.para_hesabi(yol, h)
        deg = Degisim()
        if yon == "giris":
            s = [(ph, T, 0, None), (cari["gl"], 0, T, cari["key"])]
        else:
            s = [(cari["gl"], T, 0, cari["key"]), (ph, 0, T, None)]
        deg.yeni.append((tarih, s, "cari_" + yon))
        islem = "cari_tahsilat" if yon == "giris" else "cari_odeme"
        key, hr = self._hareket(adim, islem, kul, tarih, tutar=T, yol=yol, cari=cari["key"], kapatilacak=kf,
                                hesaba_bagli=h is not None, hesaplar={h["key"]} if h else set())
        if h is not None:
            deg.benzer = (yon, yol, h["key"], cari["key"], T, tarih, ("fatura", kf) if kf else "hedefsiz")
            anahtar = deg.benzer
            deg.uygula.append(lambda _: self.benzer_idx.append({"anahtar": anahtar, "hareket": key}))
        self._hareket_kaydet(deg, adim, key, hr)
        return deg

    def _i_taksit_tahsilat(self, adim, tarih, ih, rol, kul):
        kart = self.varlik(adim["kart"])
        cari = self.v[kart["cari"]]
        T = tutar_coz(adim["tutar"], "tutar")
        self.tarih_denetle(tarih, ih)
        h = None
        if adim["yol"] != "nakit":
            h = self.hesap_sec("havale", adim.get("hesap"), ih)
            self.acilis_denetle(h, tarih, ih)
        self._hafta_sonu(adim, tarih, h)
        kalan = kart["toplam"] - self.kart_odenen(kart["key"])
        if kalan <= 0 or T > kalan:
            raise SenaryoHatasi("adım %s: BELİRSİZ-6 — kalanı aşan / kapanmış karta tahsilat" % adim["id"])
        if "taksitNo" in adim and adim["taksitNo"] > kart["sayi"]:
            raise SenaryoHatasi("adım %s: taksitNo kartın taksit sayısını aşıyor" % adim["id"])
        if tarih < kart["tarih"]:
            raise SenaryoHatasi("adım %s: K-12 — faturadan önce tarihli taksit tahsilatı planda tanımsız" % adim["id"])
        ph = self.para_hesabi(adim["yol"], h)
        deg = Degisim()
        deg.yeni.append((tarih, [(ph, T, 0, None), (cari["gl"], 0, T, cari["key"])], "taksit"))
        key, hr = self._hareket(adim, "taksit_tahsilat", kul, tarih, tutar=T, yol=adim["yol"], cari=cari["key"],
                                kart=kart["key"], hesaba_bagli=h is not None, hesaplar={h["key"]} if h else set())
        if h is not None:
            hedef = ("taksit", kart["key"], adim["taksitNo"]) if "taksitNo" in adim else ("kart", kart["key"])
            deg.benzer = ("giris", adim["yol"], h["key"], cari["key"], T, tarih, hedef)
            anahtar = deg.benzer
            deg.uygula.append(lambda _: self.benzer_idx.append({"anahtar": anahtar, "hareket": key}))
        kk = kart["key"]

        def odenen_ekle(_):
            self.odenen[kk] += T
        deg.uygula.append(odenen_ekle)
        self._hareket_kaydet(deg, adim, key, hr)
        return deg

    def kart_odenen(self, kkey):
        return self.odenen.get(kkey, 0)

    # ---- Kasa ↔ Banka ----
    def _i_kasa_banka(self, adim, tarih, ih, rol, kul):
        T = tutar_coz(adim["tutar"], "tutar")
        self.tarih_denetle(tarih, ih)
        h = self.hesap_sec("havale", adim.get("hesap"), ih)
        if h is not None and h["tur"] not in ("vadesiz", "ticari"):
            raise SenaryoHatasi("adım %s: BELİRSİZ-21 — Kasa↔Banka'da vadesiz ya da ticari hesap" % adim["id"])
        self.acilis_denetle(h, tarih, ih)
        bk = self.para_hesabi("havale", h)
        self._belirsiz4(adim, tarih, T, {h["key"]} if h else set())
        deg = Degisim()
        if adim["yon"] == "bankadan_kasaya":
            s = [("100", T, 0, None), (bk, 0, T, None)]
        else:
            s = [(bk, T, 0, None), ("100", 0, T, None)]
        deg.yeni.append((tarih, s, "kasa_banka"))
        key, hr = self._hareket(adim, "kasa_banka", kul, tarih, tutar=T, yol="havale",
                                hesaba_bagli=h is not None, hesaplar={h["key"]} if h else set())
        self._hareket_kaydet(deg, adim, key, hr)
        self._belirsiz4_kaydet(deg, tarih, T, {h["key"]} if h else set())
        return deg

    def _belirsiz4(self, adim, tarih, T, hesaplar):
        if adim.get("benzerOnay") is True or not hesaplar:
            return
        for t, tt, hs in self.belirsiz4:
            if t == tarih and tt == T and hs & hesaplar:
                raise SenaryoHatasi("adım %s: BELİRSİZ-4 — aynı gün/hesap/tutarlı ikinci banka işlemi benzerOnay:true ister" % adim["id"])

    def _belirsiz4_kaydet(self, deg, tarih, T, hesaplar):
        if hesaplar:
            deg.uygula.append(lambda _: self.belirsiz4.append((tarih, T, set(hesaplar))))

    # ---- banka işlemleri ----
    def _banka_ortak(self, adim, tarih, ih, hesaplar):
        self.tarih_denetle(tarih, ih)
        for h in hesaplar:
            self.acilis_denetle(h, tarih, ih)

    def _i_transfer(self, adim, tarih, ih, rol, kul):
        hata = False
        A = U = None
        try:
            A = self.tutar_al(adim, "tutar", "banka", ih)
        except Dur:
            hata = True
        if "ucret" in adim or "ucretHam" in adim:
            try:
                U = self.tutar_al(adim, "ucret", "banka", ih)
            except Dur:
                hata = True
        if adim["kaynak"] == adim["hedef"] or self.anahtar(adim["kaynak"]) == self.anahtar(adim["hedef"]):
            ih.ekle(2, 400, None, None, "kaynak = hedef")
            raise Dur()
        k = self.banka_hesabi_al(adim["kaynak"], TUR_102, ih)
        hd = self.banka_hesabi_al(adim["hedef"], TUR_102, ih)
        self._banka_ortak(adim, tarih, ih, [k, hd])
        if hata:
            raise Dur()
        G = 0
        if U is not None:
            v = adim["ucretVergi"]
            G = U + rh(U * 5, 100) if v == "bsmv_haric" else U
        self._belirsiz4(adim, tarih, A, {k["key"], hd["key"]})
        deg = Degisim()
        deg.yeni.append((tarih, [(hd["gl"], A, 0, None), ("770", G, 0, None), (k["gl"], 0, A + G, None)], "transfer"))
        key, hr = self._hareket(adim, "transfer", kul, tarih, tutar=A, hesaba_bagli=True,
                                hesaplar={k["key"], hd["key"]})
        self._hareket_kaydet(deg, adim, key, hr)
        self._belirsiz4_kaydet(deg, tarih, A, {k["key"], hd["key"]})
        return deg

    def _i_banka_masraf(self, adim, tarih, ih, rol, kul):
        U = self.tutar_al(adim, "tutar", "banka", ih)
        vergi = adim["vergi"]
        h = self.varlik(adim["hesap"])
        if vergi.startswith("kdv"):
            # KDV kipi: alış faturası + peşin havale (§4.20); hesap havale kuralıyla
            self.banka_hesabi_al(adim["hesap"], TUR_102, ih)
            if h["tur"] == "vadeli":
                raise SenaryoHatasi("adım %s: K-9 — KDV kipinde vadeli hesap planda tanımsız" % adim["id"])
            r = adim.get("kdvOrani", 20)
            m, kd, t = kalem_hesapla(1, U, r, vergi == "kdv_dahil", 0)
            self._belirsiz4(adim, tarih, U, {h["key"]})
            cari = self.varlik(adim["saglayici"])
            deg = self._masraf_faturasi(adim, tarih, ih, cari, h, U, r, vergi == "kdv_dahil", m, kd, t)
            key, hr = self._hareket(adim, "banka_masraf", kul, tarih, tutar=U, kip=vergi, hesaba_bagli=True,
                                    hesaplar={h["key"]})
            self._hareket_kaydet(deg, adim, key, hr)
            self._belirsiz4_kaydet(deg, tarih, U, {h["key"]})
            return deg
        h = self.banka_hesabi_al(adim["hesap"], TUR_102, ih)
        self._banka_ortak(adim, tarih, ih, [h])
        if vergi == "bsmv_dahil":
            gider = rh(U * 100, 105)
            s = [("770", gider, 0, None), ("770", U - gider, 0, None), (h["gl"], 0, U, None)]
        elif vergi == "bsmv_haric":
            bsmv = rh(U * 5, 100)
            s = [("770", U, 0, None), ("770", bsmv, 0, None), (h["gl"], 0, U + bsmv, None)]
        else:
            s = [("770", U, 0, None), (h["gl"], 0, U, None)]
        self._belirsiz4(adim, tarih, U, {h["key"]})
        deg = Degisim()
        deg.yeni.append((tarih, s, "masraf"))
        key, hr = self._hareket(adim, "banka_masraf", kul, tarih, tutar=U, kip=vergi, hesaba_bagli=True,
                                hesaplar={h["key"]})
        self._hareket_kaydet(deg, adim, key, hr)
        self._belirsiz4_kaydet(deg, tarih, U, {h["key"]})
        return deg

    def _masraf_faturasi(self, adim, tarih, ih, cari, h, U, r, dahil, m, kd, t):
        self.tarih_denetle(tarih, ih)
        self.acilis_denetle(h, tarih, ih)
        c = cari["gl"]
        deg = Degisim()
        deg.yeni.append((tarih, [("770", m, 0, None), ("191", kd, 0, None), (c, 0, t, cari["key"])], "fatura"))
        deg.yeni.append((tarih, [(c, t, 0, cari["key"]), (h["gl"], 0, t, None)], "pesin"))
        fkey = self.yeni_anahtar("fatura")
        kal = [{"urun": None, "miktar": 1, "f": U, "r": r, "dahil": dahil, "p": 0, "M": m, "K": kd, "T": t,
                "gider": "770"}]
        belge = {"tip": "fatura", "key": fkey, "tur": "alis", "masraf": True, "cari": cari["key"], "tarih": tarih,
                 "seq": self.seq, "kalemler": kal, "T": t, "M": m, "K": kd, "pesin": t, "kart": None,
                 "asil": None, "geri": None, "iade_miktar": defaultdict(int)}
        anahtar = ("cikis", "havale", h["key"], cari["key"], t, tarih, ("fatura", fkey))

        def f(_):
            self.kaydet(adim, "fatura", fkey, belge, adim["fatura"])
            self.benzer_idx.append({"anahtar": anahtar, "hareket": None})
        deg.uygula.append(f)
        return deg

    def _tek_hesapli_fis(self, adim, tarih, ih, alan):
        try:
            T = self.tutar_al(adim, alan, "banka", ih)
        except Dur:
            T = None
        h = self.banka_hesabi_al(adim["hesap"], TUR_102, ih)
        self._banka_ortak(adim, tarih, ih, [h])
        if T is None:
            raise Dur()
        return T, h

    def _i_faiz_geliri(self, adim, tarih, ih, rol, kul):
        F, h = self._tek_hesapli_fis(adim, tarih, ih, "brut")
        bp = oran_coz(adim["stopajOrani"], "stopajOrani")
        S = rh(F * bp, 10000)
        self._belirsiz4(adim, tarih, F, {h["key"]})
        deg = Degisim()
        deg.yeni.append((tarih, [(h["gl"], F - S, 0, None), ("193", S, 0, None), ("642", 0, F, None)], "faiz_geliri"))
        key, hr = self._hareket(adim, "faiz_geliri", kul, tarih, tutar=F, hesaba_bagli=True, hesaplar={h["key"]})
        self._hareket_kaydet(deg, adim, key, hr)
        self._belirsiz4_kaydet(deg, tarih, F, {h["key"]})
        return deg

    def _basit_fis(self, adim, tarih, ih, kul, islem, borc, alacak_banka):
        T, h = self._tek_hesapli_fis(adim, tarih, ih, "tutar")
        self._belirsiz4(adim, tarih, T, {h["key"]})
        deg = Degisim()
        if alacak_banka:
            s = [(borc, T, 0, None), (h["gl"], 0, T, None)]
        else:
            s = [(h["gl"], T, 0, None), (borc, 0, T, None)]
        deg.yeni.append((tarih, s, islem))
        key, hr = self._hareket(adim, islem, kul, tarih, tutar=T, hesaba_bagli=True, hesaplar={h["key"]})
        self._hareket_kaydet(deg, adim, key, hr)
        self._belirsiz4_kaydet(deg, tarih, T, {h["key"]})
        return deg

    def _i_faiz_gideri(self, adim, tarih, ih, rol, kul):
        return self._basit_fis(adim, tarih, ih, kul, "faiz_gideri", "780", True)

    def _i_diger_gelir(self, adim, tarih, ih, rol, kul):
        return self._basit_fis(adim, tarih, ih, kul, "diger_gelir", "649", False)

    def _i_diger_gider(self, adim, tarih, ih, rol, kul):
        return self._basit_fis(adim, tarih, ih, kul, "diger_gider", "659", True)

    def _i_kart_borcu_odeme(self, adim, tarih, ih, rol, kul):
        try:
            T = self.tutar_al(adim, "tutar", "banka", ih)
        except Dur:
            T = None
        k = self.banka_hesabi_al(adim["kaynak"], TUR_102, ih)
        kr = self.banka_hesabi_al(adim["kart"], {"kurumsal_kart"}, ih)
        self._banka_ortak(adim, tarih, ih, [k, kr])
        if T is None:
            raise Dur()
        self._belirsiz4(adim, tarih, T, {k["key"], kr["key"]})
        deg = Degisim()
        deg.yeni.append((tarih, [(kr["gl"], T, 0, None), (k["gl"], 0, T, None)], "kart_borcu"))
        key, hr = self._hareket(adim, "kart_borcu_odeme", kul, tarih, tutar=T, hesaba_bagli=True,
                                hesaplar={k["key"], kr["key"]})
        self._hareket_kaydet(deg, adim, key, hr)
        self._belirsiz4_kaydet(deg, tarih, T, {k["key"], kr["key"]})
        return deg

    def _i_kredi_kullanim(self, adim, tarih, ih, rol, kul):
        try:
            T = self.tutar_al(adim, "tutar", "banka", ih)
        except Dur:
            T = None
        kr = self.banka_hesabi_al(adim["kredi"], {"kredi"}, ih)
        hd = self.banka_hesabi_al(adim["hedef"], TUR_102, ih)
        self._banka_ortak(adim, tarih, ih, [kr, hd])
        if T is None:
            raise Dur()
        self._belirsiz4(adim, tarih, T, {kr["key"], hd["key"]})
        deg = Degisim()
        deg.yeni.append((tarih, [(hd["gl"], T, 0, None), (kr["gl"], 0, T, None)], "kredi_kullanim"))
        key, hr = self._hareket(adim, "kredi_kullanim", kul, tarih, tutar=T, hesaba_bagli=True,
                                hesaplar={kr["key"], hd["key"]})
        self._hareket_kaydet(deg, adim, key, hr)
        self._belirsiz4_kaydet(deg, tarih, T, {kr["key"], hd["key"]})
        return deg

    def _i_kredi_odeme(self, adim, tarih, ih, rol, kul):
        hata = False
        A = F = None
        try:
            A = self.tutar_al(adim, "anapara", "banka", ih)
        except Dur:
            hata = True
        if "faiz" in adim or "faizHam" in adim:
            try:
                F = self.tutar_al(adim, "faiz", "banka", ih)
            except Dur:
                hata = True
        kr = self.banka_hesabi_al(adim["kredi"], {"kredi"}, ih)
        k = self.banka_hesabi_al(adim["kaynak"], TUR_102, ih)
        self._banka_ortak(adim, tarih, ih, [kr, k])
        if hata:
            raise Dur()
        F = F or 0
        self._belirsiz4(adim, tarih, A, {kr["key"], k["key"]})
        deg = Degisim()
        deg.yeni.append((tarih, [(kr["gl"], A, 0, None), ("780", F, 0, None), (k["gl"], 0, A + F, None)],
                         "kredi_odeme"))
        key, hr = self._hareket(adim, "kredi_odeme", kul, tarih, tutar=A, hesaba_bagli=True,
                                hesaplar={kr["key"], k["key"]})
        self._hareket_kaydet(deg, adim, key, hr)
        self._belirsiz4_kaydet(deg, tarih, A, {kr["key"], k["key"]})
        return deg

    # ---- ters kayıt ve silme ----
    def _i_ters_kayit(self, adim, tarih, ih, rol, kul):
        hd = self.varlik(adim["hedef"])
        isl = hd["islem"]
        if isl in ("kasa_banka", "ters_kayit") or (isl == "banka_masraf" and hd["kip"].startswith("kdv")):
            raise SenaryoHatasi("adım %s: BELİRSİZ-16 — bu hedefin ters kaydı tanımsız" % adim["id"])
        if isl not in TERS_KAYDEDILIR:
            ih.ekle(4, "4xx", None, None, "ters kaydedilemeyen hedef")
            raise Dur()
        for hk in hd["hesaplar"]:
            if self.v[hk]["durum"] != "aktif":
                raise SenaryoHatasi("adım %s: K-13 — pasif hesaptaki fişin ters kaydı planda tanımsız" % adim["id"])
        if hd["ters"]:
            ih.ekle(4, 409, None, None, "ters kaydı iki kez")
            raise Dur()
        t = hd["tarih"] if (self.kilit is None or hd["tarih"] > self.kilit) else self.bugun
        if self.kilit is not None and t <= self.kilit:
            ih.ekle(4, 409, "period-locked", "CIKARIM", "ters fiş tarihi kilitli")
        deg = Degisim()
        for fid in hd["fisler"]:
            f = self.fisler[fid]
            deg.yeni.append((t, [(kod, al, bo, c) for kod, bo, al, c in f["satirlar"]], "ters"))
        key, hr = self._hareket(adim, "ters_kayit", kul, t, hedef=hd["key"], hesaba_bagli=True,
                                hesaplar=set(hd["hesaplar"]))
        deg.uygula.append(lambda _: hd.__setitem__("ters", True))
        self._hareket_kaydet(deg, adim, key, hr)
        return deg

    def _i_sil(self, adim, tarih, ih, rol, kul):
        hd = self.varlik(adim["hedef"])
        isl = hd["islem"]
        if isl not in SILINEBILIR:
            if isl in BANKA_FISI | {"transfer", "ters_kayit"}:
                ih.ekle(4, "4xx", None, None, "Banka Fişi/transfer silinmez")
                raise Dur()
            raise SenaryoHatasi("adım %s: bu hedef silinemez (dilde yok)" % adim["id"])
        if not hd["aktif"]:
            ih.ekle(4, 404, None, None, "zaten silinmiş")
            raise Dur()
        for hk in hd["hesaplar"]:
            if self.v[hk]["durum"] != "aktif":
                raise SenaryoHatasi("adım %s: K-13 — pasif hesaptaki satırın silinmesi planda tanımsız" % adim["id"])
        if self.kilit is not None and hd["tarih"] <= self.kilit:
            ih.ekle(4, 409, "period-locked", "CIKARIM", "kilitli satır silinmez")
        deg = Degisim()
        deg.silinen.extend(hd["fisler"])

        def f(_):
            hd["aktif"] = False
            if isl == "taksit_tahsilat":
                self.odenen[hd["kart"]] -= hd["tutar"]
        deg.uygula.append(f)
        return deg

    def _i_kontrol(self, *a):   # pragma: no cover (adim_isle'de işlenir)
        raise KahinHatasi("kontrol")

    # ---------------- fatura açığı (§7) ----------------
    def aciklar(self):
        """Dönüş: (açık: fatura anahtarı → kuruş, belirsiz: cari → {neden}, dağıtılmamış: cari → (giriş, çıkış))."""
        acik = {}
        belirsiz = defaultdict(set)
        dagitilmamis = {}
        belge_cari = defaultdict(list)
        for b in self.tip("fatura"):
            belge_cari[b["cari"]].append(b)
        hareket_cari = defaultdict(list)
        for x in self.tip("hareket"):
            if x["aktif"] and x["islem"] in ("cari_tahsilat", "cari_odeme"):
                hareket_cari[x["cari"]].append(x)
        for cari in self.tip("cari"):
            ck = cari["key"]
            db = sorted(belge_cari[ck], key=lambda b: (b["tarih"], b["seq"]))
            alacak = [b for b in db if b["tur"] in ("satis", "alis_iade")]
            borc = [b for b in db if b["tur"] in ("alis", "satis_iade")]
            for b in db:
                acik[b["key"]] = b["T"] - b["pesin"]                       # kural 1
                if b["asil"] is not None and b["geri"] != "acik":
                    acik[b["key"]] = 0                                      # kural 2
                if b["kart"] is not None:                                   # kural 3
                    kart = self.v[b["kart"]]
                    acik[b["key"]] = kart["toplam"] - self.kart_odenen(kart["key"])
            ch = hareket_cari[ck]
            for x in ch:                                                    # kural 4
                if x["kapatilacak"] is not None:
                    acik[x["kapatilacak"]] -= x["tutar"]
            for b in db:
                if acik[b["key"]] < 0:
                    raise KahinHatasi("açık eksi: %s" % b["key"])
            iadeler_acik = [b for b in db if b["asil"] is not None and b["geri"] == "acik"]
            for b in iadeler_acik:                                          # kural 5
                if any(x["kapatilacak"] == b["key"] for x in ch):
                    belirsiz[ck].add("K-10")
                d = min(acik[b["key"]], acik[b["asil"]])
                acik[b["asil"]] -= d
                acik[b["key"]] -= d
            bg = [x for x in ch if x["islem"] == "cari_tahsilat" and x["kapatilacak"] is None]
            bc = [x for x in ch if x["islem"] == "cari_odeme" and x["kapatilacak"] is None]
            havuz_g = sum(x["tutar"] for x in bg)
            havuz_c = sum(x["tutar"] for x in bc)
            for b in alacak:                                                # kural 6
                if b["kart"] is not None:
                    continue
                d = min(havuz_g, acik[b["key"]])
                acik[b["key"]] -= d
                havuz_g -= d
            for b in borc:
                d = min(havuz_c, acik[b["key"]])
                acik[b["key"]] -= d
                havuz_c -= d
            dagitilmamis[ck] = (havuz_g, havuz_c)
            # kesinlik
            if bg and any(b["kart"] is not None for b in db):
                belirsiz[ck].add("BELİRSİZ-7")
            if iadeler_acik and (bg or bc):
                belirsiz[ck].add("BELİRSİZ-9")
            if (bg and borc) or (bc and alacak):
                belirsiz[ck].add("BELİRSİZ-11")
            # değişmez
            sol = self.cari_bakiye(ck)
            sag = sum(acik[b["key"]] for b in alacak) - sum(acik[b["key"]] for b in borc) - havuz_g + havuz_c
            if sol != sag:
                raise KahinHatasi("cari değişmezi bozuk (%s): bakiye %d ≠ açıklar %d" % (ck, sol, sag))
        return acik, belirsiz, dagitilmamis

    # ---------------- çıktı ----------------
    def durum(self):
        """Karşılaştırılan alanlar (§8.6) + bu andaki belirsiz yollar."""
        mizan = {}
        kodlar = set()
        for fid, f in self.fisler.items():
            for kod, _, _, _ in f["satirlar"]:
                kodlar.add(kod)
        toplam_b = toplam_a = 0
        for kod in kodlar:
            b = self.bakiye(kod)
            mk = kod
            mizan.setdefault(mk, 0)
            mizan[mk] += b
        miz = {}
        for kod, b in mizan.items():
            miz[kod] = {"borc": max(0, b), "alacak": max(0, -b)}
            toplam_b += max(0, b)
            toplam_a += max(0, -b)
        if toplam_b != toplam_a:
            raise KahinHatasi("mizan dengesiz: %d ≠ %d" % (toplam_b, toplam_a))
        hesaplar = self.hesaplar()
        banka = {self.ad_ilk[h["key"]]: self.bakiye(h["gl"]) for h in hesaplar}
        kasa = self.bakiye("100")
        cariler = {self.ad_ilk[c["key"]]: self.cari_bakiye(c["key"]) for c in self.tip("cari")}
        stok = {self.ad_ilk[u["key"]]: u["miktar"] for u in self.tip("urun")}
        acik, belirsiz, _ = self.aciklar()
        faturalar = {}
        bel = []
        for b in self.tip("fatura"):
            ad = self.ad_ilk[b["key"]]
            faturalar[ad] = {"toplam": b["T"], "matrah": b["M"], "kdv": b["K"], "acik": acik[b["key"]]}
            if belirsiz.get(b["cari"]):
                bel.append(("faturalar.%s.acik" % ad, ", ".join(sorted(belirsiz[b["cari"]]))))
        kartlar = {}
        for k in self.tip("kart"):
            ad = self.ad_ilk[k["key"]]
            od = self.kart_odenen(k["key"])
            kartlar[ad] = {"toplam": k["toplam"], "odenen": od, "kalan": k["toplam"] - od}
            if belirsiz.get(k["cari"]):
                for alan in ("toplam", "odenen", "kalan"):
                    bel.append(("taksitKartlari.%s.%s" % (ad, alan), ", ".join(sorted(belirsiz[k["cari"]]))))
        if self.alis_urun & self.satis_urun:
            bel.append(("mizan.153", "BELİRSİZ-15"))
            bel.append(("mizan.621", "BELİRSİZ-15"))
        hk = {self.ad_ilk[h["key"]]: h["gl"] for h in hesaplar}
        eb = {self.ad_ilk[h["key"]]: self.hesap_etkin_politika(h) for h in hesaplar}

        def bk(pred):
            return sum(self.bakiye(k) for k in kodlar if pred(k))
        gercek = bk(lambda k: k.startswith("102.") and k != "102.00")
        atanmamis = bk(lambda k: k in ("102.00", "108.00"))
        borc = -(bk(lambda k: k.startswith("309.") or k.startswith("300.")))
        ozet = {"gercekBanka": gercek, "hesabiAtanmamis": atanmamis, "kartVeKrediBorcu": borc,
                "kasaVeGercekBanka": kasa + gercek}
        return ({"mizan": miz, "bankaHesaplari": banka, "kasa": kasa, "cariler": cariler, "stok": stok,
                 "faturalar": faturalar, "taksitKartlari": kartlar, "hesapKodlari": hk,
                 "eksiBakiyeDenetimi": eb, "ozet": ozet}, bel)

    def cikti(self):
        d, bel = self.durum()
        out = dict(d)
        retler = []
        belirsizler = [{"alan": y, "neden": n} for y, n in bel] + list(self.ara_belirsiz)
        for i, r in sorted(self.retler, key=lambda x: x[0]):
            r = dict(r)
            if "_birden_cok" in r:
                belirsizler.append({"alan": "retler.%s" % r["adim"], "neden": "BELİRSİZ-17 (%s)" % json.dumps(
                    r.pop("_birden_cok"), ensure_ascii=False)})
            retler.append(r)
        adimlar = self.sen["adimlar"]
        out["retler"] = retler
        out["yinelenenler"] = [adimlar[i]["id"] for i in sorted(self.yinelenenler)]
        out["atlananlar"] = [adimlar[i]["id"] for i in sorted(self.atlananlar)]
        out["araDurumlar"] = self.ara
        out["belirsizler"] = sorted(belirsizler, key=lambda x: (x["alan"], x["neden"]))
        return out


# --------------------------------------------------------------------------------------------
# Giriş noktası
# --------------------------------------------------------------------------------------------

def kahin(sen, dosya):
    gruplar = senaryo_dogrula(sen, dosya)
    n = len(sen["adimlar"])
    if not gruplar:
        out = Model(sen).calistir(list(range(n)))
        sonuc = {"dil": DIL, "senaryo": sen["ad"], "kaynak": "kahin"}
        sonuc.update(out)
        return sonuc
    # §5.8: her grubun her sıralaması
    grup_of = {}
    for gi, (_, idx) in enumerate(gruplar):
        for i in idx:
            grup_of[i] = gi
    perm_listeleri = [list(itertools.permutations(idx)) for _, idx in gruplar]
    toplam = 1
    for p in perm_listeleri:
        toplam *= len(p)
    if toplam > 20000:
        raise SenaryoHatasi("eşzamanlı grupların sıralama sayısı çok büyük (%d)" % toplam)
    gorulen = {}
    for secim in itertools.product(*perm_listeleri):
        sira = []
        yapilan = set()
        for i in range(n):
            if i in grup_of:
                gi = grup_of[i]
                if gi not in yapilan:
                    sira.extend(secim[gi])
                    yapilan.add(gi)
            else:
                sira.append(i)
        out = Model(sen).calistir(sira)
        anahtar = json.dumps(out, sort_keys=True, ensure_ascii=False)
        gorulen.setdefault(anahtar, out)
    alternatifler = [gorulen[k] for k in sorted(gorulen)]
    bel = {}
    for a in alternatifler:
        for b in a["belirsizler"]:
            bel[(b["alan"], b["neden"])] = b
    return {"dil": DIL, "senaryo": sen["ad"], "kaynak": "kahin", "alternatifler": alternatifler,
            "belirsizler": [bel[k] for k in sorted(bel)]}


def plan_denetimi(sen, sonuc):
    """Her kontrol adımının planBeklenen yaprakları kâhinin araDurumlar değerine tam eşit mi (§9/1)."""
    farklar = []

    def yapraklar(x, yol=()):
        if isinstance(x, dict):
            for k, v in x.items():
                yield from yapraklar(v, yol + (k,))
        else:
            yield yol, x

    def al(x, yol):
        for p in yol:          # yol demettir: "102.01" gibi noktalı anahtarlar bölünmez
            if not isinstance(x, dict) or p not in x:
                return "<YOK>"
            x = x[p]
        return x
    alts = sonuc["alternatifler"] if "alternatifler" in sonuc else [sonuc]
    sayac = 0
    for ai, a in enumerate(alts):
        for adim in sen["adimlar"]:
            if adim["islem"] != "kontrol" or "planBeklenen" not in adim:
                continue
            ara = a["araDurumlar"].get(adim["id"])
            for yol, beklenen in yapraklar(adim["planBeklenen"]):
                sayac += 1
                gercek = al(ara, yol)
                if gercek != beklenen:
                    farklar.append("alternatif %d, %s: %s plan=%r kâhin=%r" % (ai, adim["id"], "/".join(yol), beklenen,
                                                                              gercek))
    return sayac, farklar


def main(argv):
    args = [a for a in argv[1:] if not a.startswith("--")]
    bayraklar = {a for a in argv[1:] if a.startswith("--")}
    if len(args) != 1 or bayraklar - {"--plan-denetimi"}:
        sys.stderr.write("kullanım: python3 -I model.py <senaryo.json> [--plan-denetimi]\n")
        return 1
    try:
        with open(args[0], "r", encoding="utf-8") as fh:
            sen = json.load(fh)
    except (OSError, ValueError) as e:
        sys.stderr.write("dosya okunamadı: %s\n" % e)
        return 1
    try:
        sonuc = kahin(sen, args[0])
    except SenaryoHatasi as e:
        sys.stderr.write("SENARYO GEÇERSİZ: %s\n" % e)
        return 2
    except KahinHatasi as e:
        sys.stderr.write("KÂHİN İÇ HATASI: %s\n" % e)
        return 3
    sys.stdout.write(json.dumps(sonuc, sort_keys=True, indent=2, ensure_ascii=False) + "\n")
    if "--plan-denetimi" in bayraklar:
        sayac, farklar = plan_denetimi(sen, sonuc)
        if farklar:
            sys.stderr.write("PLAN DENETİMİ: %d yaprağın %d'i tutmadı\n" % (sayac, len(farklar)))
            for f in farklar:
                sys.stderr.write("  " + f + "\n")
            return 4
        sys.stderr.write("PLAN DENETİMİ: %d yaprak, hepsi tuttu\n" % sayac)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
