#!/usr/bin/env python3
"""Bağımsız muhasebe kâhini — model_b (temiz oda).

Kaynak YALNIZ: docs/BANKA-MODULU-PLAN.md, docs/BANKA-MODULU-TALIMAT.md ve test/bagimsiz/SENARYO-DILI.md
(dil sürümü destekofis-senaryo/1). Programın kodu okunmadı, içe aktarılmadı.

Kullanım:  python3 -I model.py <senaryo.json>   → stdout'a SENARYO-DILI §8 biçiminde JSON

Sözleşme (SENARYO-DILI §0): yalnız standart kütüphane; tutarlar tamsayı kuruş (kayan nokta yok); ağ ve saat yok
(bugün = senaryodaki `bugun`); aynı senaryoya her koşuda bayt bayt aynı çıktı.

Çıkış kodları: 0 başarı · 2 senaryo geçersiz (§13; stderr'e neden) · 3 kâhinin kendi değişmezi bozuldu (iç hata).

Belirsiz yerlerde verilen kararlar: KARARLAR.md (her biri K-numarasıyla koda işlendi).
"""

import copy
import datetime
import itertools
import json
import os
import re
import sys

DIL = "destekofis-senaryo/1"
EN_BUYUK_KURUS = 10 ** 14          # 1e12 TL (SENARYO-DILI §3.3; PLAN §2.1)
GECIKME = object()                 # hesap seçimi başarısız (bağımlı denetimler atlanır)


# ─────────────────────────────────────────────────────────────────────────────────────────────── hatalar

class SenaryoHatasi(Exception):
    """Senaryo geçersiz (SENARYO-DILI §13): kâhin koşmaz."""


class KahinHatasi(Exception):
    """Kâhinin kendi değişmezi bozuldu (çift taraflı kayıt, mizan dengesi, cari değişmezi)."""


class Ret(Exception):
    def __init__(self, durum, kod=None, dayanak=None, coklu=False):
        super().__init__(f"{durum} {kod}")
        self.durum, self.kod, self.dayanak, self.coklu = durum, kod, dayanak, coklu


class Yineleme(Exception):
    def __init__(self, kayit):
        super().__init__("yineleme")
        self.kayit = kayit


class Atla(Exception):
    pass


# ─────────────────────────────────────────────────────────────────────────────────────────── sayı ve tarih

def rh(a, b):
    """Yarım birim sıfırdan uzağa bölme (SENARYO-DILI §6.1): rh(a, b) = (2a + b) // (2b), a ≥ 0, b > 0."""
    if not isinstance(a, int) or not isinstance(b, int) or a < 0 or b <= 0:
        raise KahinHatasi(f"rh tanımsız: rh({a!r}, {b!r})")
    return (2 * a + b) // (2 * b)


TUTAR_RE = re.compile(r"^[0-9]{1,13}(,[0-9]{1,2})?$")
TUTAR_ISARETLI_RE = re.compile(r"^-?[0-9]{1,13}(,[0-9]{1,2})?$")
ORAN_RE = re.compile(r"^[0-9]{1,3}(,[0-9]{1,2})?$")
HAM_RE = re.compile(r"^(-?)([0-9]+)(?:,([0-9]+))?$")
TAKMA_RE = re.compile(r"^[A-Z][A-Z0-9_]{0,15}$")
ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,31}$")
TARIH_RE = re.compile(r"^([0-9]{2})\.([0-9]{2})\.([0-9]{4})$")


def kurus(metin):
    """Senaryo tutarı (biçimi doğrulanmış) → kuruş. Tek haneli ondalık ×10 (SENARYO-DILI §3.3)."""
    isaret = -1 if metin.startswith("-") else 1
    metin = metin.lstrip("-")
    tam, _, ond = metin.partition(",")
    if len(ond) == 1:
        ond += "0"
    return isaret * (int(tam) * 100 + (int(ond) if ond else 0))


def oran_bp(metin):
    """Yüzde metni → baz puan: "15" → 1500, "2,5" → 250 (SENARYO-DILI §3.3)."""
    tam, _, ond = metin.partition(",")
    if len(ond) == 1:
        ond += "0"
    return int(tam) * 100 + (int(ond) if ond else 0)


def ham_coz(metin, uc, sifir_olur=False, eksi_olur=False):
    """`<alan>Ham` değerini çözer (SENARYO-DILI §6.2). Geçersizse None (→ 400).

    uc='banka': 2'den çok ondalık, eksi, sıfır ya da 1e12 TL üstü → 400 (PLAN §5.1).
    uc='modul': ondalık rh ile kuruşa yuvarlanır ("1,005" → 1,01); sıfır, eksi, 1e12 TL üstü → 400 (PLAN §2.1).
    K6: yalnız virgüllü ondalık ve isteğe bağlı '-' tanınır; başka biçim (nokta, bilimsel gösterim) → 400.
    """
    if not isinstance(metin, str):
        return None
    m = HAM_RE.match(metin)
    if not m:
        return None
    isaret, tam, ond = m.group(1), m.group(2), m.group(3) or ""
    if uc == "banka":
        if len(ond) > 2:
            return None
        deger = int(tam) * 100 + (int(ond.ljust(2, "0")) if ond else 0)
    else:
        olcek = 10 ** len(ond)
        deger = rh(int(tam + ond) * 100, olcek)
    if isaret:
        if not eksi_olur or deger == 0:
            return None
        deger = -deger
    if deger == 0 and not sifir_olur:
        return None
    if abs(deger) > EN_BUYUK_KURUS:
        return None
    return deger


def tarih_coz(metin):
    if not isinstance(metin, str):
        raise SenaryoHatasi(f"tarih metin değil: {metin!r}")
    m = TARIH_RE.match(metin)
    if not m:
        raise SenaryoHatasi(f"tarih biçimi gg.aa.yyyy değil: {metin!r}")
    try:
        return datetime.date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
    except ValueError:
        raise SenaryoHatasi(f"geçersiz takvim günü: {metin!r}")


def iban_gecerli(iban):
    """TR IBAN: 26 karakter, TR + rakam, mod 97 = 1 (SENARYO-DILI §4.4). K23: boşluklar atılır, büyük harf."""
    if not isinstance(iban, str):
        return False
    s = iban.replace(" ", "").upper()
    if len(s) != 26 or not s.startswith("TR") or not s[2:].isdigit():
        return False
    duzen = s[4:] + s[:4]
    sayi = "".join(str(int(ch, 36)) for ch in duzen)
    return int(sayi) % 97 == 1


def iban_norm(iban):
    return iban.replace(" ", "").upper()


# ───────────────────────────────────────────────────────────────────────────────────── senaryo şeması (§3, §4)

ORTAK = {"id", "islem", "not", "kullanici", "istekKimligi", "benzerOnay", "yineDeKaydet", "ayniAnda"}

# islem → (zorunlu alanlar, isteğe bağlı alanlar, tarih alanı kullanılır mı, 'ad' durumu: 'zorunlu'|'secimli'|None)
SEMA = {
    "saat": ({"bugun"}, set(), False, None),
    "ayar": (set(), {"kasaEksiBakiye", "benzerIslemUyarisi"}, False, None),
    "donem_kilidi": ({"kilitTarihi"}, set(), False, None),
    "hesap_ac": ({"banka", "hesapAdi", "tur", "paraBirimi", "acilisTarihi"},
                 {"kod", "iban", "acilisBakiyesi", "acilisBakiyesiHam", "bakiyeDogrulandi", "kmhLimiti", "kartLimiti"},
                 False, "zorunlu"),
    "hesap_durum": ({"hesap", "durum"}, set(), False, None),
    "hesap_eksi_politika": ({"hesap", "politika"}, set(), False, None),
    "acilis_duzelt": ({"hesap", "acilisTarihi"}, {"acilisBakiyesi", "acilisBakiyesiHam", "bakiyeDogrulandi"}, False, None),
    "kasa_acilis": ({"tutar"}, set(), True, None),
    "kasa_hareket": ({"yon", "tutar", "aciklama"}, set(), True, "secimli"),
    "cari_ac": ({"unvan", "tur"}, {"iban"}, False, "zorunlu"),
    "urun_ac": ({"urunAdi", "birim"}, set(), False, "zorunlu"),
    "stok_giris": ({"urun", "miktar"}, set(), False, None),
    "fatura": ({"tur", "cari", "kalemler"}, {"odeme"}, True, "zorunlu"),
    "iade": ({"asilFatura", "kalemler", "geri"}, set(), True, "zorunlu"),
    "cari_tahsilat": ({"cari", "yol"}, {"tutar", "tutarHam", "hesap", "kapatilacakFatura"}, True, "secimli"),
    "cari_odeme": ({"cari", "yol"}, {"tutar", "tutarHam", "hesap", "kapatilacakFatura"}, True, "secimli"),
    "taksit_tahsilat": ({"kart", "tutar", "yol"}, {"hesap", "taksitNo"}, True, "secimli"),
    "kasa_banka": ({"yon", "tutar"}, {"hesap"}, True, "secimli"),
    "transfer": ({"kaynak", "hedef"}, {"tutar", "tutarHam", "ucret", "ucretHam", "ucretVergi"}, True, "secimli"),
    "banka_masraf": ({"hesap", "masrafTuru", "vergi"}, {"tutar", "tutarHam", "saglayici", "fatura", "kdvOrani"}, True,
                     "secimli"),
    "faiz_geliri": ({"hesap", "stopajOrani"}, {"brut", "brutHam"}, True, "secimli"),
    "faiz_gideri": ({"hesap"}, {"tutar", "tutarHam"}, True, "secimli"),
    "diger_gelir": ({"hesap"}, {"tutar", "tutarHam"}, True, "secimli"),
    "diger_gider": ({"hesap"}, {"tutar", "tutarHam"}, True, "secimli"),
    "kart_borcu_odeme": ({"kaynak", "kart"}, {"tutar", "tutarHam"}, True, "secimli"),
    "kredi_kullanim": ({"kredi", "hedef"}, {"tutar", "tutarHam"}, True, "secimli"),
    "kredi_odeme": ({"kredi", "kaynak"}, {"anapara", "anaparaHam", "faiz", "faizHam"}, True, "secimli"),
    "ters_kayit": ({"hedef"}, set(), False, "secimli"),
    "sil": ({"hedef"}, set(), False, None),
    "kontrol": (set(), {"planMetni", "planBeklenen"}, False, None),
}

# tutar alanı (ve Ham çifti) zorunlu olan işlemler: alan → uç türü ('banka' | 'modul' | None = Ham yok, BELİRSİZ-22)
TUTAR_ALANLARI = {
    "hesap_ac": {"acilisBakiyesi": "banka"},
    "acilis_duzelt": {"acilisBakiyesi": "banka"},
    "kasa_acilis": {"tutar": None},
    "kasa_hareket": {"tutar": None},
    "cari_tahsilat": {"tutar": "modul"},
    "cari_odeme": {"tutar": "modul"},
    "taksit_tahsilat": {"tutar": None},
    "kasa_banka": {"tutar": None},
    "transfer": {"tutar": "banka"},
    "banka_masraf": {"tutar": "banka"},
    "faiz_geliri": {"brut": "banka"},
    "faiz_gideri": {"tutar": "banka"},
    "diger_gelir": {"tutar": "banka"},
    "diger_gider": {"tutar": "banka"},
    "kart_borcu_odeme": {"tutar": "banka"},
    "kredi_kullanim": {"tutar": "banka"},
    "kredi_odeme": {"anapara": "banka"},
}
# isteğe bağlı tutar alanları
SECIMLI_TUTAR = {"transfer": {"ucret": "banka"}, "kredi_odeme": {"faiz": "banka"}}

GOVDE_DISI = {"id", "ad", "not", "istekKimligi", "benzerOnay", "yineDeKaydet", "ayniAnda"}

HESAP_TURLERI = {"vadesiz", "ticari", "vadeli", "diger", "kurumsal_kart", "kredi"}
TUR_102 = {"vadesiz", "ticari", "vadeli", "diger"}
HAVALE_TURLERI = {"vadesiz", "ticari", "diger"}
MASRAF_TURLERI = {"EFT", "FAST", "Havale", "SWIFT", "Hesap İşletim", "Döviz İşlem", "Diğer"}
VERGI_KIPLERI = {"bsmv_dahil", "bsmv_haric", "yok", "kdv_dahil", "kdv_haric"}
POLITIKALAR = {"uyar", "engelle", "kontrol_yok"}
ROLLER = {"yonetici", "muhasebe", "personel"}

# Takma ad türleri
T_HESAP, T_CARI, T_URUN, T_FATURA, T_TAKSIT, T_HAREKET = "hesap", "cari", "urun", "fatura", "taksit", "hareket"

FIS_ISLEMLERI = {"banka_masraf", "faiz_geliri", "faiz_gideri", "diger_gelir", "diger_gider", "kart_borcu_odeme",
                 "kredi_kullanim", "kredi_odeme"}
TERS_HEDEFLERI = {"transfer"} | FIS_ISLEMLERI
SIL_HEDEFLERI = {"cari_tahsilat", "cari_odeme", "taksit_tahsilat", "kasa_hareket", "kasa_banka"}
BENZER_ISLEMLERI = {"cari_tahsilat", "cari_odeme", "taksit_tahsilat"}
DUBLE_GRUBU = {"kasa_banka", "transfer"} | FIS_ISLEMLERI      # BELİRSİZ-4


def _tutar_bicim(op, alan, deger, isaretli=False):
    rx = TUTAR_ISARETLI_RE if isaretli else TUTAR_RE
    if not isinstance(deger, str) or not rx.match(deger):
        raise SenaryoHatasi(f"{op}.{alan}: tutar biçimi geçersiz {deger!r} (SENARYO-DILI §3.3)")


def _alias_bicim(yer, deger):
    if not isinstance(deger, str) or not TAKMA_RE.match(deger):
        raise SenaryoHatasi(f"{yer}: takma ad biçimi geçersiz {deger!r}")


def senaryo_dogrula(sen, dosya_adi):
    """SENARYO-DILI §13 durağan denetimleri. Koşu sırasında anlaşılabilenler (BELİRSİZ-1, 6, 10, 14, 19, 20 …)
    adım çalışırken SenaryoHatasi ile durdurulur."""
    if not isinstance(sen, dict):
        raise SenaryoHatasi("senaryo nesne değil")
    bilinen_ust = {"dil", "ad", "aciklama", "dayanak", "baslangic", "adimlar"}
    fazla = set(sen) - bilinen_ust
    if fazla:
        raise SenaryoHatasi(f"bilinmeyen üst alan: {sorted(fazla)}")
    if sen.get("dil") != DIL:
        raise SenaryoHatasi(f"dil {DIL!r} değil")
    beklenen_ad = os.path.basename(dosya_adi)
    if beklenen_ad.endswith(".json"):
        beklenen_ad = beklenen_ad[:-5]
    if sen.get("ad") != beklenen_ad:
        raise SenaryoHatasi(f"ad ({sen.get('ad')!r}) dosya adıyla ({beklenen_ad!r}) aynı değil")
    b = sen.get("baslangic")
    if not isinstance(b, dict):
        raise SenaryoHatasi("baslangic yok")
    fazla = set(b) - {"bugun", "sirket", "ayarlar", "kullanicilar"}
    if fazla:
        raise SenaryoHatasi(f"baslangic bilinmeyen alan: {sorted(fazla)}")
    bugun = tarih_coz(b.get("bugun"))
    if b.get("sirket") != "bos":
        raise SenaryoHatasi("baslangic.sirket yalnız 'bos'")
    ay = b.get("ayarlar", {})
    if not isinstance(ay, dict) or set(ay) - {"kasaEksiBakiye", "benzerIslemUyarisi"}:
        raise SenaryoHatasi("baslangic.ayarlar geçersiz")
    if "kasaEksiBakiye" in ay and ay["kasaEksiBakiye"] not in POLITIKALAR:
        raise SenaryoHatasi("kasaEksiBakiye geçersiz")
    if "benzerIslemUyarisi" in ay and ay["benzerIslemUyarisi"] not in ("acik", "kapali"):
        raise SenaryoHatasi("benzerIslemUyarisi geçersiz")
    kul = b.get("kullanicilar", {})
    if not isinstance(kul, dict):
        raise SenaryoHatasi("kullanicilar nesne değil")
    for k, v in kul.items():
        if v not in ROLLER:
            raise SenaryoHatasi(f"kullanıcı {k}: rol {v!r} geçersiz")
    if "Y" in kul and kul["Y"] != "yonetici":
        raise SenaryoHatasi("Y her zaman yonetici")
    kullanicilar = dict(kul)
    kullanicilar["Y"] = "yonetici"

    adimlar = sen.get("adimlar")
    if not isinstance(adimlar, list) or not adimlar:
        raise SenaryoHatasi("adimlar boş ya da liste değil")

    idler = set()
    tanim = {}                 # takma ad → (tür, alt bilgi)
    son_saat = bugun
    gruplar_gorulen = set()
    onceki_grup = None

    def ref(yer, ad, tur, alt=None):
        _alias_bicim(yer, ad)
        if ad not in tanim:
            raise SenaryoHatasi(f"{yer}: {ad!r} daha önce tanımlanmamış")
        if tanim[ad][0] != tur:
            raise SenaryoHatasi(f"{yer}: {ad!r} türü {tanim[ad][0]}, beklenen {tur}")
        if alt is not None and tanim[ad][1] not in alt:
            raise SenaryoHatasi(f"{yer}: {ad!r} ({tanim[ad][1]}) bu alanda kullanılamaz")
        return tanim[ad]

    def tanimla(yer, ad, tur, alt=None):
        _alias_bicim(yer, ad)
        if ad in tanim:
            raise SenaryoHatasi(f"{yer}: takma ad {ad!r} ikinci kez tanımlanıyor")
        tanim[ad] = (tur, alt)

    for sira, a in enumerate(adimlar):
        if not isinstance(a, dict):
            raise SenaryoHatasi(f"adım {sira} nesne değil")
        aid = a.get("id")
        if not isinstance(aid, str) or not ID_RE.match(aid) or aid in idler:
            raise SenaryoHatasi(f"adım {sira}: id geçersiz ya da yinelenmiş: {aid!r}")
        idler.add(aid)
        op = a.get("islem")
        if op not in SEMA:
            raise SenaryoHatasi(f"{aid}: bilinmeyen islem {op!r}")
        zorunlu, secimli, tarihli, ad_durum = SEMA[op]
        izinli = set(zorunlu) | set(secimli) | {"id", "islem", "not"}
        if op not in ("kontrol", "saat"):
            izinli |= {"kullanici", "istekKimligi", "benzerOnay", "yineDeKaydet", "ayniAnda"}
        if tarihli:
            izinli.add("tarih")
        if ad_durum:
            izinli.add("ad")
        # K22: tarih yalnız deftere tarihli yazan işlemlerde (SENARYO-DILI §3.2 "kullanılmaz")
        fazla = set(a) - izinli
        if fazla:
            raise SenaryoHatasi(f"{aid}: bilinmeyen/kullanılmayan alan {sorted(fazla)}")
        eksik = {z for z in zorunlu if z not in a}
        if eksik:
            raise SenaryoHatasi(f"{aid}: zorunlu alan eksik {sorted(eksik)}")
        if ad_durum == "zorunlu" and "ad" not in a:
            raise SenaryoHatasi(f"{aid}: 'ad' zorunlu")
        if "tarih" in a:
            tarih_coz(a["tarih"])
        if "kullanici" in a and a["kullanici"] not in kullanicilar:
            raise SenaryoHatasi(f"{aid}: kullanıcı {a['kullanici']!r} tanımsız")
        for bayrak in ("benzerOnay", "yineDeKaydet"):
            if bayrak in a and not isinstance(a[bayrak], bool):
                raise SenaryoHatasi(f"{aid}: {bayrak} true/false olmalı")
        if "istekKimligi" in a and not isinstance(a["istekKimligi"], str):
            raise SenaryoHatasi(f"{aid}: istekKimligi metin olmalı")
        # ayniAnda grupları ardışık, en çok 4 adım, kontrol yok
        grup = a.get("ayniAnda")
        if grup is not None:
            if not isinstance(grup, str) or not grup:
                raise SenaryoHatasi(f"{aid}: ayniAnda geçersiz")
            if grup != onceki_grup and grup in gruplar_gorulen:
                raise SenaryoHatasi(f"{aid}: ayniAnda grubu {grup!r} ardışık değil")
            gruplar_gorulen.add(grup)
        onceki_grup = grup

        # tutar alanları
        for alan, uc in TUTAR_ALANLARI.get(op, {}).items():
            var = alan in a
            ham = (alan + "Ham") in a
            if op in ("hesap_ac",) and not var and not ham:
                raise SenaryoHatasi(f"{aid}: {alan} zorunlu")
            if op == "acilis_duzelt" and not var and not ham:
                raise SenaryoHatasi(f"{aid}: {alan} zorunlu")
            if var and ham:
                raise SenaryoHatasi(f"{aid}: {alan} ile {alan}Ham birlikte")
            if not var and not ham:
                raise SenaryoHatasi(f"{aid}: {alan} zorunlu")
            if ham and uc is None:
                raise SenaryoHatasi(f"{aid}: {alan}Ham bu işlemde yok (BELİRSİZ-22)")
            if var:
                _tutar_bicim(aid, alan, a[alan], isaretli=(alan == "acilisBakiyesi"))
            if ham and not isinstance(a[alan + "Ham"], str):
                raise SenaryoHatasi(f"{aid}: {alan}Ham metin olmalı")
        for alan, uc in SECIMLI_TUTAR.get(op, {}).items():
            if alan in a and (alan + "Ham") in a:
                raise SenaryoHatasi(f"{aid}: {alan} ile {alan}Ham birlikte")
            if alan in a:
                _tutar_bicim(aid, alan, a[alan])
            if (alan + "Ham") in a and not isinstance(a[alan + "Ham"], str):
                raise SenaryoHatasi(f"{aid}: {alan}Ham metin olmalı")

        # işleme özgü
        if op == "saat":
            yeni = tarih_coz(a["bugun"])
            if yeni < son_saat:
                raise SenaryoHatasi(f"{aid}: saat geri gidiyor")
            son_saat = yeni
        elif op == "ayar":
            if not a.keys() & {"kasaEksiBakiye", "benzerIslemUyarisi"}:
                raise SenaryoHatasi(f"{aid}: ayar boş")
            if "kasaEksiBakiye" in a and a["kasaEksiBakiye"] not in POLITIKALAR:
                raise SenaryoHatasi(f"{aid}: kasaEksiBakiye geçersiz")
            if "benzerIslemUyarisi" in a and a["benzerIslemUyarisi"] not in ("acik", "kapali"):
                raise SenaryoHatasi(f"{aid}: benzerIslemUyarisi geçersiz")
        elif op == "donem_kilidi":
            tarih_coz(a["kilitTarihi"])
        elif op == "hesap_ac":
            tur = a["tur"]
            if tur not in HESAP_TURLERI:
                raise SenaryoHatasi(f"{aid}: hesap türü {tur!r}")
            if a["paraBirimi"] != "TRY":
                raise SenaryoHatasi(f"{aid}: yalnız TRY (döviz kapsam dışı)")
            tarih_coz(a["acilisTarihi"])
            if "iban" in a and tur in ("kurumsal_kart", "kredi"):
                raise SenaryoHatasi(f"{aid}: {tur} hesabında IBAN yok")
            if "kmhLimiti" in a:
                if tur not in ("vadesiz", "ticari", "diger"):
                    raise SenaryoHatasi(f"{aid}: kmhLimiti yalnız vadesiz/ticari/diğer")
                _tutar_bicim(aid, "kmhLimiti", a["kmhLimiti"])
            if "kartLimiti" in a:
                if tur != "kurumsal_kart":
                    raise SenaryoHatasi(f"{aid}: kartLimiti yalnız kurumsal_kart")
                _tutar_bicim(aid, "kartLimiti", a["kartLimiti"])
            if "acilisBakiyesi" in a and a["acilisBakiyesi"].startswith("-") and tur not in ("vadesiz", "ticari", "diger"):
                raise SenaryoHatasi(f"{aid}: eksi açılış yalnız vadesiz/ticari/diğer (SENARYO-DILI §3.3)")
            if tur == "kredi" and a.get("bakiyeDogrulandi") is True:
                raise SenaryoHatasi(f"{aid}: kredi hesabı bakiyeDogrulandi:false açılır (BELİRSİZ-2)")
            if "bakiyeDogrulandi" in a and not isinstance(a["bakiyeDogrulandi"], bool):
                raise SenaryoHatasi(f"{aid}: bakiyeDogrulandi true/false")
            for metin in ("banka", "hesapAdi"):
                if not isinstance(a[metin], str) or not a[metin]:
                    raise SenaryoHatasi(f"{aid}: {metin} boş")
            if "kod" in a and (not isinstance(a["kod"], str) or not a["kod"]):
                raise SenaryoHatasi(f"{aid}: kod boş")
            tanimla(aid, a["ad"], T_HESAP, tur)
        elif op == "hesap_durum":
            ref(aid, a["hesap"], T_HESAP)
            if a["durum"] not in ("pasif", "aktif"):
                raise SenaryoHatasi(f"{aid}: durum geçersiz")
        elif op == "hesap_eksi_politika":
            ref(aid, a["hesap"], T_HESAP, TUR_102 | {"kurumsal_kart"})
            if a["politika"] not in POLITIKALAR:
                raise SenaryoHatasi(f"{aid}: politika geçersiz")
        elif op == "acilis_duzelt":
            tur = ref(aid, a["hesap"], T_HESAP)[1]
            tarih_coz(a["acilisTarihi"])
            if "acilisBakiyesi" in a and a["acilisBakiyesi"].startswith("-") and tur not in ("vadesiz", "ticari", "diger"):
                raise SenaryoHatasi(f"{aid}: eksi açılış yalnız vadesiz/ticari/diğer")
            if tur == "kredi" and a.get("bakiyeDogrulandi") is True:
                raise SenaryoHatasi(f"{aid}: kredi hesabı doğrulanmaz (BELİRSİZ-2)")
        elif op == "kasa_hareket":
            if a["yon"] not in ("giris", "cikis"):
                raise SenaryoHatasi(f"{aid}: yon geçersiz")
            if not isinstance(a["aciklama"], str) or "açılış" in a["aciklama"].lower():
                raise SenaryoHatasi(f"{aid}: aciklama 'açılış' içeremez (SENARYO-DILI §4.9)")
        elif op == "cari_ac":
            if a["tur"] not in ("musteri", "tedarikci"):
                raise SenaryoHatasi(f"{aid}: cari türü geçersiz")
            tanimla(aid, a["ad"], T_CARI, a["tur"])
        elif op == "urun_ac":
            if a["birim"] != "Adet":
                raise SenaryoHatasi(f"{aid}: birim yalnız Adet")
            tanimla(aid, a["ad"], T_URUN)
        elif op == "stok_giris":
            ref(aid, a["urun"], T_URUN)
            _miktar(aid, a["miktar"])
        elif op == "fatura":
            _fatura_dogrula(aid, a, ref, tanimla)
        elif op == "iade":
            ref(aid, a["asilFatura"], T_FATURA, {"satis", "alis", "masraf"})
            ks = a["kalemler"]
            if not isinstance(ks, list) or not ks:
                raise SenaryoHatasi(f"{aid}: iade kalemleri boş")
            for k in ks:
                if not isinstance(k, dict) or set(k) != {"kalem", "miktar"}:
                    raise SenaryoHatasi(f"{aid}: iade kalemi {{kalem, miktar}}")
                _miktar(aid, k["kalem"])
                _miktar(aid, k["miktar"])
            g = a["geri"]
            if not isinstance(g, dict) or g.get("yol") not in ("acik", "nakit", "havale"):
                raise SenaryoHatasi(f"{aid}: geri.yol geçersiz")
            if set(g) - {"yol", "hesap"}:
                raise SenaryoHatasi(f"{aid}: geri bilinmeyen alan")
            if "hesap" in g:
                if g["yol"] != "havale":
                    raise SenaryoHatasi(f"{aid}: geri.hesap yalnız havalede (SENARYO-DILI §5.2/5)")
                ref(aid, g["hesap"], T_HESAP)
            tanimla(aid, a["ad"], T_FATURA, "iade")
        elif op in ("cari_tahsilat", "cari_odeme"):
            ref(aid, a["cari"], T_CARI)
            yollar = ("nakit", "havale") if op == "cari_tahsilat" else ("nakit", "havale", "kart")
            if a["yol"] not in yollar:
                raise SenaryoHatasi(f"{aid}: yol {a['yol']!r} (kart yalnız ödeme yönünde)")
            if "hesap" in a:
                if a["yol"] == "nakit":
                    raise SenaryoHatasi(f"{aid}: nakitte hesap verilmez (SENARYO-DILI §5.2/5)")
                ref(aid, a["hesap"], T_HESAP)
            if "kapatilacakFatura" in a:
                ref(aid, a["kapatilacakFatura"], T_FATURA)
            if "ad" in a:
                tanimla(aid, a["ad"], T_HAREKET, op)
        elif op == "taksit_tahsilat":
            ref(aid, a["kart"], T_TAKSIT)
            _tutar_bicim(aid, "tutar", a["tutar"])
            if a["yol"] not in ("nakit", "havale"):
                raise SenaryoHatasi(f"{aid}: yol geçersiz")
            if "hesap" in a:
                if a["yol"] == "nakit":
                    raise SenaryoHatasi(f"{aid}: nakitte hesap verilmez")
                ref(aid, a["hesap"], T_HESAP)
            if "taksitNo" in a:
                _miktar(aid, a["taksitNo"])
            if "ad" in a:
                tanimla(aid, a["ad"], T_HAREKET, op)
        elif op == "kasa_banka":
            if a["yon"] not in ("bankadan_kasaya", "kasadan_bankaya"):
                raise SenaryoHatasi(f"{aid}: yon geçersiz")
            if "hesap" in a:
                ref(aid, a["hesap"], T_HESAP)
            if "ad" in a:
                tanimla(aid, a["ad"], T_HAREKET, op)
        elif op == "transfer":
            ref(aid, a["kaynak"], T_HESAP)
            ref(aid, a["hedef"], T_HESAP)
            if "ucretVergi" in a and a["ucretVergi"] not in ("bsmv_haric", "bsmv_dahil", "yok"):
                raise SenaryoHatasi(f"{aid}: ucretVergi geçersiz")
            if "ucretVergi" in a and "ucret" not in a and "ucretHam" not in a:
                raise SenaryoHatasi(f"{aid}: ucretVergi var ama ucret yok")
            if "ad" in a:
                tanimla(aid, a["ad"], T_HAREKET, op)
        elif op == "banka_masraf":
            ref(aid, a["hesap"], T_HESAP)
            if a["masrafTuru"] not in MASRAF_TURLERI:
                raise SenaryoHatasi(f"{aid}: masrafTuru geçersiz")
            if a["vergi"] not in VERGI_KIPLERI:
                raise SenaryoHatasi(f"{aid}: vergi geçersiz")
            kdv = a["vergi"].startswith("kdv")
            if not kdv and (a.keys() & {"saglayici", "fatura", "kdvOrani"}):
                raise SenaryoHatasi(f"{aid}: saglayici/fatura/kdvOrani yalnız KDV kipinde")
            if "kdvOrani" in a and a["kdvOrani"] not in (1, 10, 20):
                raise SenaryoHatasi(f"{aid}: kdvOrani 1/10/20")
            if "saglayici" in a:
                ref(aid, a["saglayici"], T_CARI, {"tedarikci"})
            if kdv and "saglayici" in a and "fatura" not in a:
                raise SenaryoHatasi(f"{aid}: KDV kipinde 'fatura' adı zorunlu (§13/8)")
            if "fatura" in a:
                tanimla(aid, a["fatura"], T_FATURA, "masraf")
            if "ad" in a:
                tanimla(aid, a["ad"], T_HAREKET, "banka_masraf_kdv" if kdv else op)
        elif op == "faiz_geliri":
            ref(aid, a["hesap"], T_HESAP)
            if not isinstance(a["stopajOrani"], str) or not ORAN_RE.match(a["stopajOrani"]):
                raise SenaryoHatasi(f"{aid}: stopajOrani biçimi")
            if oran_bp(a["stopajOrani"]) > 10000:
                raise SenaryoHatasi(f"{aid}: stopaj %100'ü aşamaz (K18)")
            if "ad" in a:
                tanimla(aid, a["ad"], T_HAREKET, op)
        elif op in ("faiz_gideri", "diger_gelir", "diger_gider"):
            ref(aid, a["hesap"], T_HESAP)
            if "ad" in a:
                tanimla(aid, a["ad"], T_HAREKET, op)
        elif op == "kart_borcu_odeme":
            ref(aid, a["kaynak"], T_HESAP)
            ref(aid, a["kart"], T_HESAP)
            if "ad" in a:
                tanimla(aid, a["ad"], T_HAREKET, op)
        elif op in ("kredi_kullanim", "kredi_odeme"):
            ref(aid, a["kredi"], T_HESAP)
            ref(aid, a["hedef" if op == "kredi_kullanim" else "kaynak"], T_HESAP)
            if "ad" in a:
                tanimla(aid, a["ad"], T_HAREKET, op)
        elif op == "ters_kayit":
            hedef_tur = ref(aid, a["hedef"], T_HAREKET)[1]
            if hedef_tur in ("banka_masraf_kdv", "kasa_banka", "ters_kayit"):
                raise SenaryoHatasi(f"{aid}: {hedef_tur} ters kaydedilmez (BELİRSİZ-16)")
            if "ad" in a:
                tanimla(aid, a["ad"], T_HAREKET, "ters_kayit")
        elif op == "sil":
            hedef_tur = ref(aid, a["hedef"], T_HAREKET)[1]
            if hedef_tur not in SIL_HEDEFLERI | TERS_HEDEFLERI | {"banka_masraf_kdv", "ters_kayit"}:
                raise SenaryoHatasi(f"{aid}: {hedef_tur} bu dilde silinmez")
        elif op == "kontrol":
            if "planBeklenen" in a and not isinstance(a["planBeklenen"], dict):
                raise SenaryoHatasi(f"{aid}: planBeklenen nesne olmalı")
        elif op == "kasa_acilis":
            pass

    # ayniAnda: en çok 4 adım; grupta kontrol yok
    i = 0
    while i < len(adimlar):
        g = adimlar[i].get("ayniAnda")
        if g is None:
            i += 1
            continue
        j = i
        while j < len(adimlar) and adimlar[j].get("ayniAnda") == g:
            if adimlar[j]["islem"] == "kontrol":
                raise SenaryoHatasi(f"{adimlar[j]['id']}: grupta kontrol olmaz")
            j += 1
        if j - i > 4:
            raise SenaryoHatasi(f"ayniAnda {g!r}: en çok 4 adım")
        i = j
    return bugun, kullanicilar


def _miktar(yer, deger):
    if not isinstance(deger, int) or isinstance(deger, bool) or deger < 1:
        raise SenaryoHatasi(f"{yer}: miktar/sıra tamsayı ≥ 1 olmalı ({deger!r})")


def _fatura_dogrula(aid, a, ref, tanimla):
    tur = a["tur"]
    if tur not in ("satis", "alis"):
        raise SenaryoHatasi(f"{aid}: fatura türü geçersiz")
    ref(aid, a["cari"], T_CARI)
    ks = a["kalemler"]
    if not isinstance(ks, list) or not ks:
        raise SenaryoHatasi(f"{aid}: en az bir kalem")
    gorulen = set()
    for k in ks:
        if not isinstance(k, dict):
            raise SenaryoHatasi(f"{aid}: kalem nesne değil")
        fazla = set(k) - {"urun", "hizmet", "miktar", "birimFiyat", "birimFiyatHam", "kdvOrani", "kdvDahil",
                          "iskontoOrani", "giderTuru"}
        if fazla:
            raise SenaryoHatasi(f"{aid}: kalem bilinmeyen alan {sorted(fazla)}")
        if ("urun" in k) == ("hizmet" in k):
            raise SenaryoHatasi(f"{aid}: kalemde urun ya da hizmet (yalnız biri)")
        if "urun" in k:
            ref(aid, k["urun"], T_URUN)
        elif not isinstance(k["hizmet"], str) or not k["hizmet"]:
            raise SenaryoHatasi(f"{aid}: hizmet açıklaması boş")
        _miktar(aid, k.get("miktar"))
        if ("birimFiyat" in k) == ("birimFiyatHam" in k):
            raise SenaryoHatasi(f"{aid}: birimFiyat ya da birimFiyatHam (yalnız biri)")
        if "birimFiyat" in k:
            _tutar_bicim(aid, "birimFiyat", k["birimFiyat"])
        elif not isinstance(k["birimFiyatHam"], str):
            raise SenaryoHatasi(f"{aid}: birimFiyatHam metin")
        if k.get("kdvOrani") not in (1, 10, 20):
            raise SenaryoHatasi(f"{aid}: kdvOrani 1/10/20")
        if not isinstance(k.get("kdvDahil"), bool):
            raise SenaryoHatasi(f"{aid}: kdvDahil true/false")
        if "iskontoOrani" in k:
            if not isinstance(k["iskontoOrani"], str) or not ORAN_RE.match(k["iskontoOrani"]):
                raise SenaryoHatasi(f"{aid}: iskontoOrani biçimi")
            if oran_bp(k["iskontoOrani"]) >= 10000:
                raise SenaryoHatasi(f"{aid}: iskonto %100'den küçük olmalı")
            if oran_bp(k["iskontoOrani"]) > 0 and k["miktar"] != 1:
                raise SenaryoHatasi(f"{aid}: iskontolu kalemde miktar 1 (BELİRSİZ-13)")
        anahtar = (k["kdvOrani"], k["kdvDahil"])
        if anahtar in gorulen:
            raise SenaryoHatasi(f"{aid}: aynı (oran, dahil) için ikinci kalem (BELİRSİZ-12)")
        gorulen.add(anahtar)
        if "giderTuru" in k:
            if tur != "alis" or "hizmet" not in k or k["giderTuru"] != "Banka Masrafları":
                raise SenaryoHatasi(f"{aid}: giderTuru yalnız alış hizmet kaleminde ve 'Banka Masrafları'")
        elif tur == "alis" and "hizmet" in k:
            raise SenaryoHatasi(f"{aid}: alış hizmet kaleminde giderTuru zorunlu")
    od = a.get("odeme")
    if od is not None:
        if not isinstance(od, dict) or set(od) - {"pesin", "taksit"}:
            raise SenaryoHatasi(f"{aid}: odeme geçersiz")
        pesin = od.get("pesin", [])
        if not isinstance(pesin, list) or len(pesin) > 3:
            raise SenaryoHatasi(f"{aid}: pesin en çok 3 satır")
        tamami = 0
        for p in pesin:
            if not isinstance(p, dict) or set(p) - {"yol", "tutar", "hesap"} or "yol" not in p or "tutar" not in p:
                raise SenaryoHatasi(f"{aid}: pesin satırı {{yol, tutar, hesap}}")
            if p["yol"] not in ("nakit", "havale", "kart"):
                raise SenaryoHatasi(f"{aid}: pesin yol")
            if p["yol"] == "kart" and tur != "alis":
                raise SenaryoHatasi(f"{aid}: kart yolu yalnız alış faturasında (§4.13)")
            if p["tutar"] == "tamami":
                tamami += 1
            else:
                _tutar_bicim(aid, "pesin.tutar", p["tutar"])
            if "hesap" in p:
                if p["yol"] == "nakit":
                    raise SenaryoHatasi(f"{aid}: nakitte hesap verilmez")
                ref(aid, p["hesap"], T_HESAP)
        if tamami > 1:
            raise SenaryoHatasi(f"{aid}: birden çok 'tamami'")
        if "taksit" in od:
            t = od["taksit"]
            if tur != "satis":
                raise SenaryoHatasi(f"{aid}: taksit yalnız satış faturasında")
            if tamami:
                raise SenaryoHatasi(f"{aid}: 'tamami' taksitle birlikte olmaz")
            if not isinstance(t, dict) or set(t) - {"ad", "sayi", "ilkVade"} or "ad" not in t or "sayi" not in t:
                raise SenaryoHatasi(f"{aid}: taksit {{ad, sayi, ilkVade}}")
            _miktar(aid, t["sayi"])
            if "ilkVade" in t:
                tarih_coz(t["ilkVade"])
    tanimla(aid, a["ad"], T_FATURA, tur)
    if od is not None and "taksit" in od:
        tanimla(aid, od["taksit"]["ad"], T_TAKSIT)


# ──────────────────────────────────────────────────────────────────────────────────────────────── durum

class Durum:
    def __init__(self, bugun, kullanicilar, ayarlar):
        self.bugun = bugun
        self.kilit = None
        self.kasa_politika = ayarlar.get("kasaEksiBakiye")
        self.benzer_acik = ayarlar.get("benzerIslemUyarisi", "acik") == "acik"
        self.kullanicilar = kullanicilar
        self.takma = {}            # takma ad → (tür, iç anahtar)
        self.hesaplar = {}         # iç anahtar → hesap
        self.alt_sayac = {"102": 0, "309": 0, "300": 0}
        self.cariler = {}
        self.urunler = {}
        self.fisler = []           # {id, tur, tarih, satirlar[(kod, taraf, tutar, cari)], etkin}
        self.belgeler = {}         # faturalar, iadeler, KDV'li masraf faturaları
        self.kartlar = {}          # taksit kartları
        self.hareketler = {}
        self.para = []             # para satırları (Benzer İşlem ve §7 için)
        self.istekler = {}
        self.sayac = 0
        self.retler = []
        self.yinelenenler = []
        self.atlananlar = []
        self.ara = {}
        self.ara_belirsiz = {}
        self.ret_belirsiz = []

    def yeni_anahtar(self, on):
        self.sayac += 1
        return f"{on}{self.sayac}"

    def coz(self, ad, tur):
        if ad not in self.takma:
            raise Atla()
        t, k = self.takma[ad]
        if t != tur:
            raise SenaryoHatasi(f"{ad} türü {t}, beklenen {tur}")
        return k

    def takma_ver(self, ad, tur, anahtar):
        if ad in self.takma:
            raise SenaryoHatasi(f"takma ad {ad} ikinci kez")
        self.takma[ad] = (tur, anahtar)

    # ── defter
    def fis_yaz(self, tur, tarih, satirlar, sira):
        satirlar = [s for s in satirlar if s[2] != 0]
        for kod, taraf, tutar, _ in satirlar:
            if taraf not in ("B", "A") or not isinstance(tutar, int) or tutar < 0:
                raise KahinHatasi(f"geçersiz satır {kod} {taraf} {tutar}")
        borc = sum(s[2] for s in satirlar if s[1] == "B")
        alacak = sum(s[2] for s in satirlar if s[1] == "A")
        if borc != alacak:
            raise KahinHatasi(f"fiş dengesiz ({tur}): borç {borc} ≠ alacak {alacak}")
        fis = {"id": self.yeni_anahtar("FS"), "tur": tur, "tarih": tarih, "satirlar": satirlar, "etkin": True,
               "sira": sira}
        self.fisler.append(fis)
        return fis["id"]

    def fis(self, fid):
        for f in self.fisler:
            if f["id"] == fid:
                return f
        raise KahinHatasi(f"fiş yok {fid}")

    def bakiye(self, kod, tarih=None, cari=None):
        t = 0
        for f in self.fisler:
            if not f["etkin"] or (tarih is not None and f["tarih"] > tarih):
                continue
            for k, taraf, tutar, c in f["satirlar"]:
                if k != kod or (cari is not None and c != cari):
                    continue
                t += tutar if taraf == "B" else -tutar
        return t

    def hesap_kodu_hareketli(self):
        kodlar = set()
        for f in self.fisler:
            if f["etkin"]:
                for k, _, _, _ in f["satirlar"]:
                    kodlar.add(k)
        return kodlar

    # ── hesap yardımcıları
    def hesap_alt(self, hk):
        return self.hesaplar[hk]["alt"]

    def para_kodu(self, yol, hk):
        if yol == "nakit":
            return "100"
        if hk is None:
            return "102.00" if yol == "havale" else "108.00"
        return self.hesap_alt(hk)

    def cari_kodu(self, ck):
        return "120" if self.cariler[ck]["tur"] == "musteri" else "320"

    def etkin_politika(self, hk):
        h = self.hesaplar[hk]
        if not h["dogrulandi"]:
            return "kontrol_yok"
        return h["politika"] or "uyar"


# ──────────────────────────────────────────────────────────────────────────────────────── adım bağlamı

YETKI = {
    # işlem → {rol: sonuç}; 'B' = plan söylemiyor (BELİRSİZ-18) → senaryo geçersiz
    "ayar": {"yonetici": 200, "muhasebe": "B", "personel": "B"},
    "donem_kilidi": {"yonetici": 200, "muhasebe": "B", "personel": "B"},
    "hesap_ac": {"yonetici": 200, "muhasebe": 200, "personel": 403},
    "hesap_durum": {"yonetici": 200, "muhasebe": 200, "personel": 403},
    "hesap_eksi_politika": {"yonetici": 200, "muhasebe": 200, "personel": 403},
    "acilis_duzelt": {"yonetici": 200, "muhasebe": 200, "personel": 403},
    "kasa_acilis": {"yonetici": 200, "muhasebe": "B", "personel": "B"},
    "kasa_hareket": {"yonetici": 200, "muhasebe": "B", "personel": "B"},
    "cari_ac": {"yonetici": 200, "muhasebe": "B", "personel": "B"},
    "urun_ac": {"yonetici": 200, "muhasebe": "B", "personel": "B"},
    "stok_giris": {"yonetici": 200, "muhasebe": "B", "personel": "B"},
    "fatura": {"yonetici": 200, "muhasebe": "B", "personel": "B"},
    "iade": {"yonetici": 200, "muhasebe": "B", "personel": "B"},
    "cari_tahsilat": {"yonetici": 200, "muhasebe": 200, "personel": 200},
    "cari_odeme_banka": {"yonetici": 200, "muhasebe": 200, "personel": 403},
    "cari_odeme_nakit": {"yonetici": 200, "muhasebe": "B", "personel": "B"},
    "taksit_tahsilat": {"yonetici": 200, "muhasebe": 200, "personel": 200},
    "kasa_banka": {"yonetici": 200, "muhasebe": "B", "personel": 403},
    "transfer": {"yonetici": 200, "muhasebe": 200, "personel": 403},
    "kredi_kullanim": {"yonetici": 200, "muhasebe": 200, "personel": 403},
    "kredi_odeme": {"yonetici": 200, "muhasebe": 200, "personel": 403},
    "banka_fisi": {"yonetici": 200, "muhasebe": 200, "personel": 403},
    "banka_masraf_kdv": {"yonetici": 200, "muhasebe": "B", "personel": 403},
    "ters_kayit": {"yonetici": 200, "muhasebe": 200, "personel": 403},
    "sil_bagli": {"yonetici": 200, "muhasebe": "B", "personel": 403},
    "sil_nakit_kendi": {"yonetici": 200, "muhasebe": "B", "personel": 200},
    "sil_nakit_baska": {"yonetici": 200, "muhasebe": "B", "personel": "B"},
}


class Baglam:
    def __init__(self, d, a, sira):
        self.d, self.a, self.sira = d, a, sira
        self.kullanici = a.get("kullanici", "Y")
        self.rol = d.kullanicilar[self.kullanici]
        self.ihlaller = []
        self.tanimlar = []           # (alan, tür, anahtar) — yineleme için

    def ekle(self, oncelik, durum, kod=None, dayanak=None):
        self.ihlaller.append((oncelik, len(self.ihlaller), durum, kod, dayanak))

    def yetki(self, anahtar):
        sonuc = YETKI[anahtar][self.rol]
        if sonuc == "B":
            raise SenaryoHatasi(f"{self.a['id']}: {anahtar} × {self.rol} planda yok (BELİRSİZ-18)")
        if sonuc == 403:
            self.ekle(1, 403)

    def tarih(self):
        t = tarih_coz(self.a["tarih"]) if "tarih" in self.a else self.d.bugun
        if t > self.d.bugun:
            self.ekle(2, 400)                         # PLAN §2.5 ileri tarih
        return t

    def kilit(self, t):
        if self.d.kilit is not None and t <= self.d.kilit:
            self.ekle(4, 409, "period-locked", "CIKARIM")

    def tutar(self, alan, uc, sifir_olur=False, eksi_olur=False, kaynak=None):
        kaynak = self.a if kaynak is None else kaynak
        if alan + "Ham" in kaynak:
            v = ham_coz(kaynak[alan + "Ham"], uc, sifir_olur=sifir_olur, eksi_olur=eksi_olur)
            if v is None:
                self.ekle(2, 400)
            return v
        if alan not in kaynak:
            return None
        v = kurus(kaynak[alan])
        if (v == 0 and not sifir_olur) or abs(v) > EN_BUYUK_KURUS:
            self.ekle(2, 400)
            return None
        return v

    def hesap_sec(self, kategori, verilen_ad):
        """SENARYO-DILI §5.2. Dönüş: hesap anahtarı, None (hesapsız: 102.00/108.00) ya da GECIKME (ihlal)."""
        d = self.d
        verilen = d.coz(verilen_ad, T_HESAP) if verilen_ad is not None else None
        uygun = [k for k, h in d.hesaplar.items() if _uygun(h, kategori)]
        if not uygun:
            if verilen is not None:
                self.ekle(2, 400, "bank-account-invalid", "CIKARIM")
                return GECIKME
            return None
        if verilen is None:
            if len(uygun) == 1:
                return uygun[0]
            self.ekle(2, 400, "bank-account-required", "PLAN")
            return GECIKME
        if verilen not in uygun:
            self.ekle(2, 400, "bank-account-invalid", "CIKARIM")
            return GECIKME
        return verilen

    def fis_hesabi(self, ad, turler):
        """Banka Fişi, transfer, kart borcu, kredi: hesap açıkça verilir; tür ve aktiflik denetlenir."""
        hk = self.d.coz(ad, T_HESAP)
        h = self.d.hesaplar[hk]
        if h["durum"] != "aktif" or h["tur"] not in turler:
            self.ekle(2, 400, "bank-account-invalid", "CIKARIM")
            return GECIKME
        return hk

    def acilis_oncesi(self, hk, t):
        if hk is None or hk is GECIKME:
            return
        if t < self.d.hesaplar[hk]["acilis_tarihi"]:
            self.ekle(4, "4xx", "bank-before-opening", "CIKARIM")

    def istek(self):
        """§5.4 istek kimliği: yineleme ya da 409 (öncelik 3)."""
        kimlik = self.a.get("istekKimligi")
        if kimlik is None:
            return
        anahtar = (self.kullanici, self.a["islem"], kimlik)
        onceki = self.d.istekler.get(anahtar)
        if onceki is None:
            return
        if onceki["govde"] == govde(self.a):
            if not any(i[0] <= 2 for i in self.ihlaller):
                raise Yineleme(onceki)
        else:
            self.ekle(3, 409)

    def on_kapi(self):
        if self.ihlaller:
            ilk = min(self.ihlaller)
            raise Ret(ilk[2], ilk[3], ilk[4], coklu=len(self.ihlaller) > 1)


def _uygun(h, kategori):
    if h["durum"] != "aktif":
        return False
    if kategori == "havale":
        return h["tur"] in HAVALE_TURLERI
    if kategori == "kart":
        return h["tur"] == "kurumsal_kart"
    raise KahinHatasi(kategori)


def govde(a):
    """§5.4 gövde: adımın alanları − GOVDE_DISI. K37: yalnız senaryoda var olan takma ad TANIMLARI (fatura
    ödemesindeki `taksit.ad`, KDV'li masraftaki `fatura`) programa gönderilmez, gövdeye girmez."""
    g = {k: v for k, v in a.items() if k not in GOVDE_DISI}
    if a.get("islem") == "banka_masraf":
        g.pop("fatura", None)
    if a.get("islem") == "fatura" and isinstance(g.get("odeme"), dict) and isinstance(g["odeme"].get("taksit"), dict):
        g["odeme"] = dict(g["odeme"])
        g["odeme"]["taksit"] = {k: v for k, v in g["odeme"]["taksit"].items() if k != "ad"}
    return json.dumps(g, sort_keys=True, ensure_ascii=False)


# ─────────────────────────────────────────────────────────────────────────────── eksi bakiye (§5.3)

def etki_hesapla(satirlar, isaret=1):
    etki = {}
    for kod, taraf, tutar, _ in satirlar:
        etki[kod] = etki.get(kod, 0) + isaret * (tutar if taraf == "B" else -tutar)
    return etki


def politika_ve_limit(d, kod):
    if kod == "100":
        if d.kasa_politika is None:
            raise SenaryoHatasi("Kasa'yı azaltan adım var ama kasaEksiBakiye verilmemiş (BELİRSİZ-1)")
        return d.kasa_politika, 0
    if kod in ("102.00", "108.00"):
        return None, 0
    for hk, h in d.hesaplar.items():
        if h["alt"] == kod:
            if h["ana"] == "300":
                return None, 0                       # BELİRSİZ-2
            return d.etkin_politika(hk), h["limit"]
    return None, 0


def eksi_denetle(c, etki, tarih):
    """Yazımdan SONRA, azalan her hesapta: m = min(Bh(d), Bh(tüm)) + L; m < 0 ise ihlal (PLAN §3.9)."""
    d = c.d
    ihlal = []
    for kod in sorted(etki):
        if etki[kod] >= 0:
            continue
        pol, limit = politika_ve_limit(d, kod)
        if pol is None or pol == "kontrol_yok":
            continue
        m = min(d.bakiye(kod, tarih), d.bakiye(kod)) + limit
        if m < 0:
            ihlal.append((pol, kod))
    if not ihlal:
        return
    engel = [x for x in ihlal if x[0] == "engelle"]
    uyar = [x for x in ihlal if x[0] == "uyar"]
    if c.a.get("yineDeKaydet") and not engel:
        if any(k != "100" for _, k in uyar) and c.rol == "personel":
            raise SenaryoHatasi(f"{c.a['id']}: personelin banka Uyar'ını geçmesi planda yok (BELİRSİZ-18)")
        return
    coklu = bool(engel) and bool(uyar) and not c.a.get("yineDeKaydet")
    if engel:
        raise Ret(409, "cash-blocked", "PLAN", coklu=coklu)
    raise Ret(409, "cash-negative", "CIKARIM")


# ───────────────────────────────────────────────────────────────────────────── Benzer İşlem (§5.4)

def benzer_anahtar(satir):
    return (satir["yon"], satir["yol"], satir["hesap"], satir["cari"], satir["tutar"], satir["tarih"], satir["hedef"])


def benzer_denetle(c, satir):
    """Yalnız hesaba bağlı cari_tahsilat/cari_odeme/taksit_tahsilat; aynı anahtarlı etkin önceki satır → 409."""
    d = c.d
    if not d.benzer_acik or satir["hesap"] is None or satir["yol"] == "nakit":
        return
    if satir["tarih"].weekday() >= 5:
        raise SenaryoHatasi(f"{c.a['id']}: hesaba bağlı tahsilat/ödeme hafta sonu tarihli (BELİRSİZ-5)")
    anahtar = benzer_anahtar(satir)
    etkin = [p for p in d.para if p["hesap"] is not None and benzer_anahtar(p) == anahtar and p["etkin"]]
    silinmis = [p for p in d.para if p["hesap"] is not None and benzer_anahtar(p) == anahtar and not p["etkin"]]
    if silinmis and not c.a.get("benzerOnay"):
        raise SenaryoHatasi(f"{c.a['id']}: silinmiş satırla aynı anahtar; benzerOnay:true gerekir (BELİRSİZ-19)")
    if etkin and not c.a.get("benzerOnay"):
        c.ekle(5, 409, "bank-similar", "PLAN")


def duble_denetle(c, islem, tarih, hesaplar, tutar):
    """BELİRSİZ-4: Kasa↔Banka, transfer ve Banka Fişleri'nde aynı gün + ortak hesap + aynı tutarlı ikincisi
    yalnız benzerOnay:true ile yazılır (kâhin bank-similar üretmez)."""
    if c.a.get("benzerOnay") or not c.d.benzer_acik:
        return
    for h in c.d.hareketler.values():
        if h["islem"] not in DUBLE_GRUBU or h.get("duble") is None:
            continue
        t2, hs2, tutar2 = h["duble"]
        if t2 == tarih and tutar2 == tutar and set(hs2) & set(hesaplar):
            raise SenaryoHatasi(f"{c.a['id']}: aynı gün, aynı hesap, aynı tutarlı ikinci {islem}; "
                                f"benzerOnay:true gerekir (BELİRSİZ-4)")


# ────────────────────────────────────────────────────────────────────────────────── Kasa sırası (B-20)

def kasa_sirasi_denetle(d, adim_id, tarih, satirlar):
    """BELİRSİZ-20: senaryo Kasa hareketlerini tarih sırasıyla yazar; geriye tarihli yeni Kasa satırı → geçersiz."""
    if not any(s[0] == "100" and s[2] != 0 for s in satirlar):
        return
    en_gec = None
    for f in d.fisler:
        if f["etkin"] and any(s[0] == "100" for s in f["satirlar"]):
            en_gec = f["tarih"] if en_gec is None or f["tarih"] > en_gec else en_gec
    if en_gec is not None and tarih < en_gec:
        raise SenaryoHatasi(f"{adim_id}: Kasa hareketi tarih sırasında değil (BELİRSİZ-20)")


# ──────────────────────────────────────────────────────────────────────────────── fatura hesapları (§6.3)

def kalem_hesapla(q, f, r, p, dahil):
    brut = q * f
    if dahil:
        h = rh(brut * 100, 100 + r)
        if p == 0:
            m = h
            k = brut - m
            t = brut
        else:
            m = h - rh(h * p, 10000)
            k = rh(m * r, 100)
            t = m + k
    else:
        m = brut - rh(brut * p, 10000)
        k = rh(m * r, 100)
        t = m + k
    if m < 0 or k < 0 or t <= 0:
        raise SenaryoHatasi("kalem tutarı sıfır ya da eksi")
    return m, k, t


# ────────────────────────────────────────────────────────────────────────────────────────── işlemler

def h_ayar(c):
    c.yetki("ayar")
    c.istek()
    c.on_kapi()
    if "kasaEksiBakiye" in c.a:
        c.d.kasa_politika = c.a["kasaEksiBakiye"]
    if "benzerIslemUyarisi" in c.a:
        c.d.benzer_acik = c.a["benzerIslemUyarisi"] == "acik"


def h_donem_kilidi(c):
    c.yetki("donem_kilidi")
    t = tarih_coz(c.a["kilitTarihi"])
    if t > c.d.bugun:
        raise SenaryoHatasi(f"{c.a['id']}: kilit tarihi bugünden sonra (K17)")
    if c.d.kilit is not None and t < c.d.kilit:
        raise SenaryoHatasi(f"{c.a['id']}: kilit geri alınamaz (K17)")
    c.istek()
    c.on_kapi()
    c.d.kilit = t


def acilis_satirlari(h, s):
    alt = h["alt"]
    if s == 0:
        return []
    if h["ana"] == "102":
        if s > 0:
            return [(alt, "B", s, None), ("500", "A", s, None)]
        return [("500", "B", -s, None), (alt, "A", -s, None)]
    return [("500", "B", s, None), (alt, "A", s, None)]       # 309 ve 300: S = borç tutarı


def h_hesap_ac(c):
    a, d = c.a, c.d
    c.yetki("hesap_ac")
    tur = a["tur"]
    eksi_olur = tur in ("vadesiz", "ticari", "diger")
    s = c.tutar("acilisBakiyesi", "banka", sifir_olur=True, eksi_olur=eksi_olur)
    if s is not None and s < 0 and not eksi_olur:
        c.ekle(2, 400)
        s = None
    acilis = tarih_coz(a["acilisTarihi"])
    if acilis > d.bugun:
        c.ekle(2, 400)
    iban = a.get("iban")
    if iban is not None and not iban_gecerli(iban):
        c.ekle(2, 400)
    limit = 0
    if "kmhLimiti" in a:
        limit = kurus(a["kmhLimiti"])
    if "kartLimiti" in a:
        limit = kurus(a["kartLimiti"])
    c.istek()
    if d.kilit is not None and acilis <= d.kilit:
        c.ekle(4, 409, "period-locked", "CIKARIM")
    if iban is not None and iban_gecerli(iban):
        for h in d.hesaplar.values():
            if h["iban"] and h["iban"] == iban_norm(iban):
                c.ekle(4, 409)
                break
    if "kod" in a:
        for h in d.hesaplar.values():
            if h["kod"] == a["kod"]:
                c.ekle(4, "4xx")
                break
    c.on_kapi()
    ana = "102" if tur in TUR_102 else ("309" if tur == "kurumsal_kart" else "300")
    d.alt_sayac[ana] += 1
    alt = f"{ana}.{d.alt_sayac[ana]:02d}"
    hk = d.yeni_anahtar("H")
    h = {"tur": tur, "ana": ana, "alt": alt, "acilis_tarihi": acilis, "dogrulandi": bool(a.get("bakiyeDogrulandi")),
         "politika": None, "limit": limit, "durum": "aktif", "kod": a.get("kod"),
         "iban": iban_norm(iban) if iban else None, "acilis_fis": None}
    d.hesaplar[hk] = h
    satirlar = acilis_satirlari(h, s)
    h["acilis_fis"] = d.fis_yaz("acilis", acilis, satirlar, c.sira)
    c.tanimlar.append(("ad", T_HESAP, hk))


def h_hesap_durum(c):
    c.yetki("hesap_durum")
    hk = c.d.coz(c.a["hesap"], T_HESAP)
    c.istek()
    c.on_kapi()
    c.d.hesaplar[hk]["durum"] = c.a["durum"]


def h_hesap_eksi_politika(c):
    c.yetki("hesap_eksi_politika")
    hk = c.d.coz(c.a["hesap"], T_HESAP)
    if not c.d.hesaplar[hk]["dogrulandi"]:
        raise SenaryoHatasi(f"{c.a['id']}: politika yalnız doğrulanmış hesapta (BELİRSİZ-3)")
    c.istek()
    c.on_kapi()
    c.d.hesaplar[hk]["politika"] = c.a["politika"]


def ilk_hareket_tarihi(d, hk):
    alt = d.hesaplar[hk]["alt"]
    en = None
    for f in d.fisler:
        if not f["etkin"] or f["tur"] in ("acilis", "acilis_ters"):
            continue
        if any(s[0] == alt for s in f["satirlar"]):
            en = f["tarih"] if en is None or f["tarih"] < en else en
    return en


def h_acilis_duzelt(c):
    a, d = c.a, c.d
    c.yetki("acilis_duzelt")
    hk = d.coz(a["hesap"], T_HESAP)
    h = d.hesaplar[hk]
    eksi_olur = h["tur"] in ("vadesiz", "ticari", "diger")
    if "acilisBakiyesi" not in a and "acilisBakiyesiHam" not in a:
        raise SenaryoHatasi(f"{a['id']}: acilisBakiyesi zorunlu")
    s = c.tutar("acilisBakiyesi", "banka", sifir_olur=True, eksi_olur=eksi_olur)
    if s is not None and s < 0 and not eksi_olur:
        c.ekle(2, 400)
        s = None
    yeni = tarih_coz(a["acilisTarihi"])
    if yeni > d.bugun:
        c.ekle(2, 400)
    c.istek()
    if d.kilit is not None and h["acilis_tarihi"] <= d.kilit:
        c.ekle(4, 409)                                           # kilitli açılış düzeltilmez (PLAN §3.8)
    elif d.kilit is not None and yeni <= d.kilit:
        c.ekle(4, 409, "period-locked", "CIKARIM")               # K15
    ilk = ilk_hareket_tarihi(d, hk)
    if ilk is not None and yeni > ilk:
        c.ekle(4, 409, "bank-opening-after-first", "PLAN")
    c.on_kapi()
    eski = d.fis(h["acilis_fis"])
    if eski["satirlar"]:
        d.fis_yaz("acilis_ters", eski["tarih"], [(k, "A" if t == "B" else "B", u, cc) for k, t, u, cc in eski["satirlar"]],
                  c.sira)
    h["acilis_tarihi"] = yeni
    h["acilis_fis"] = d.fis_yaz("acilis", yeni, acilis_satirlari(h, s), c.sira)
    if "bakiyeDogrulandi" in a:
        h["dogrulandi"] = bool(a["bakiyeDogrulandi"])


def h_kasa_acilis(c):
    c.yetki("kasa_acilis")
    t = c.tutar("tutar", None)
    tarih = c.tarih()
    c.istek()
    c.kilit(tarih)
    c.on_kapi()
    satirlar = [("100", "B", t, None), ("500", "A", t, None)]        # [YAYGIN] §4.8
    kasa_sirasi_denetle(c.d, c.a["id"], tarih, satirlar)
    c.d.fis_yaz("kasa_acilis", tarih, satirlar, c.sira)


def yeni_hareket(c, islem, tarih, fisler, **ek):
    hk = c.d.yeni_anahtar("M")
    kayit = {"islem": islem, "tarih": tarih, "kullanici": c.kullanici, "fisler": fisler, "silindi": False,
             "ters": None, "sira": c.sira}
    kayit.update(ek)
    c.d.hareketler[hk] = kayit
    if "ad" in c.a:
        c.tanimlar.append(("ad", T_HAREKET, hk))
    return hk


def h_kasa_hareket(c):
    a, d = c.a, c.d
    c.yetki("kasa_hareket")
    t = c.tutar("tutar", None)
    tarih = c.tarih()
    c.istek()
    c.kilit(tarih)
    c.on_kapi()
    if a["yon"] == "giris":
        satirlar = [("100", "B", t, None), ("649", "A", t, None)]
    else:
        satirlar = [("770", "B", t, None), ("100", "A", t, None)]
    kasa_sirasi_denetle(d, a["id"], tarih, satirlar)
    fid = d.fis_yaz("kasa_hareket", tarih, satirlar, c.sira)
    yeni_hareket(c, "kasa_hareket", tarih, [fid], hesapli=False)
    eksi_denetle(c, etki_hesapla(satirlar), tarih)


def h_cari_ac(c):
    a, d = c.a, c.d
    c.yetki("cari_ac")
    if "iban" in a and not iban_gecerli(a["iban"]):
        c.ekle(2, 400)                                           # K7
    c.istek()
    c.on_kapi()
    ck = d.yeni_anahtar("C")
    d.cariler[ck] = {"tur": a["tur"], "unvan": a["unvan"]}
    c.tanimlar.append(("ad", T_CARI, ck))


def h_urun_ac(c):
    c.yetki("urun_ac")
    c.istek()
    c.on_kapi()
    uk = c.d.yeni_anahtar("U")
    c.d.urunler[uk] = {"miktar": 0, "alis": False, "satis": False}
    c.tanimlar.append(("ad", T_URUN, uk))


def h_stok_giris(c):
    c.yetki("stok_giris")
    uk = c.d.coz(c.a["urun"], T_URUN)
    c.istek()
    c.on_kapi()
    c.d.urunler[uk]["miktar"] += c.a["miktar"]


def para_satiri(d, tur, yon, yol, hk, cari, tutar, tarih, hedef, **ek):
    s = {"id": d.yeni_anahtar("P"), "tur": tur, "yon": yon, "yol": yol, "hesap": hk, "cari": cari, "tutar": tutar,
         "tarih": tarih, "hedef": hedef, "etkin": True}
    s.update(ek)
    return s


def h_fatura(c):
    a, d = c.a, c.d
    c.yetki("fatura")
    ck = d.coz(a["cari"], T_CARI)
    kalemler = []
    for k in a["kalemler"]:
        uk = d.coz(k["urun"], T_URUN) if "urun" in k else None
        f = c.tutar("birimFiyat", "modul", kaynak=k)
        p = oran_bp(k["iskontoOrani"]) if "iskontoOrani" in k else 0
        kalemler.append({"urun": uk, "hizmet": k.get("hizmet"), "miktar": k["miktar"], "fiyat": f,
                         "oran": k["kdvOrani"], "dahil": k["kdvDahil"], "iskonto": p})
    tarih = c.tarih()
    od = a.get("odeme") or {}
    pesin_ham = od.get("pesin", [])
    pesinler = []
    for p in pesin_ham:
        tut = None if p["tutar"] == "tamami" else c.tutar("tutar", None, kaynak=p)
        hk = None
        if p["yol"] in ("havale", "kart"):
            hk = c.hesap_sec(p["yol"], p.get("hesap"))
        pesinler.append({"yol": p["yol"], "tutar": tut, "tamami": p["tutar"] == "tamami", "hesap": hk})
    c.istek()
    c.kilit(tarih)
    for p in pesinler:
        c.acilis_oncesi(p["hesap"], tarih)
    # tutarlar
    m_top = k_top = t_top = 0
    m_stok = m_hizmet = 0
    if all(k["fiyat"] is not None for k in kalemler):
        for k in kalemler:
            k["M"], k["K"], k["T"] = kalem_hesapla(k["miktar"], k["fiyat"], k["oran"], k["iskonto"], k["dahil"])
            m_top += k["M"]
            k_top += k["K"]
            t_top += k["T"]
            if k["urun"] is not None:
                m_stok += k["M"]
            else:
                m_hizmet += k["M"]
        diger = sum(p["tutar"] for p in pesinler if not p["tamami"] and p["tutar"] is not None)
        if diger > t_top:
            c.ekle(4, "4xx")                                      # Σ peşin > T
        for p in pesinler:
            if p["tamami"]:
                p["tutar"] = t_top - diger
                if p["tutar"] == 0 and diger <= t_top:
                    raise SenaryoHatasi(f"{a['id']}: 'tamami' sıfır çıkıyor (K35)")
    c.on_kapi()
    # stok
    for k in kalemler:
        if k["urun"] is None:
            continue
        u = d.urunler[k["urun"]]
        if a["tur"] == "satis":
            u["miktar"] -= k["miktar"]
            u["satis"] = True
            if u["miktar"] < 0:
                raise SenaryoHatasi(f"{a['id']}: stok eksiye düşüyor (BELİRSİZ-14)")
        else:
            u["miktar"] += k["miktar"]
            u["alis"] = True
    cari_kod = d.cari_kodu(ck)
    if a["tur"] == "satis":
        satirlar = [(cari_kod, "B", t_top, ck), ("600", "A", m_top, None), ("391", "A", k_top, None)]
    else:
        satirlar = [("153", "B", m_stok, None), ("770", "B", m_hizmet, None), ("191", "B", k_top, None),
                    (cari_kod, "A", t_top, ck)]
    bk = d.yeni_anahtar("F")
    fisler = [d.fis_yaz("fatura", tarih, satirlar, c.sira)]
    belge = {"tur": a["tur"], "cari": ck, "tarih": tarih, "sira": c.sira, "M": m_top, "K": k_top, "T": t_top,
             "kalemler": kalemler, "pesin": 0, "kart": None, "asil": None, "geri": None, "iade_edilen": {},
             "masraf": False}
    d.belgeler[bk] = belge
    c.tanimlar.append(("ad", T_FATURA, bk))
    etki_top = {}
    yeni_para = []
    for p in pesinler:
        kod = d.para_kodu(p["yol"], p["hesap"])
        if a["tur"] == "satis":
            ps = [(kod, "B", p["tutar"], None), (cari_kod, "A", p["tutar"], ck)]
            yon = "giris"
        else:
            ps = [(cari_kod, "B", p["tutar"], ck), (kod, "A", p["tutar"], None)]
            yon = "cikis"
        kasa_sirasi_denetle(d, a["id"], tarih, ps)
        fisler.append(d.fis_yaz("pesin", tarih, ps, c.sira))
        for kk, vv in etki_hesapla(ps).items():
            etki_top[kk] = etki_top.get(kk, 0) + vv
        belge["pesin"] += p["tutar"]
        yeni_para.append(para_satiri(d, "pesin", yon, p["yol"], p["hesap"], ck, p["tutar"], tarih, ("fatura", bk),
                                     belge=bk))
    d.para.extend(yeni_para)
    belge["fisler"] = fisler
    if "taksit" in od:
        toplam = t_top - belge["pesin"]
        if toplam <= 0:
            raise SenaryoHatasi(f"{a['id']}: taksit kartının tutarı sıfır (K19)")
        tk = d.yeni_anahtar("K")
        d.kartlar[tk] = {"belge": bk, "cari": ck, "toplam": toplam, "sayi": od["taksit"]["sayi"]}
        belge["kart"] = tk
        c.tanimlar.append(("odeme.taksit.ad", T_TAKSIT, tk))
    eksi_denetle(c, etki_top, tarih)


def h_iade(c):
    a, d = c.a, c.d
    c.yetki("iade")
    ak = d.coz(a["asilFatura"], T_FATURA)
    asil = d.belgeler[ak]
    if asil["tur"] not in ("satis", "alis"):
        raise SenaryoHatasi(f"{a['id']}: asıl belge fatura değil")
    if asil["kart"] is not None:
        raise SenaryoHatasi(f"{a['id']}: taksitli faturanın iadesi (BELİRSİZ-8)")
    tarih = c.tarih()
    g = a["geri"]
    hk = None
    if g["yol"] == "havale":
        hk = c.hesap_sec("havale", g.get("hesap"))
    c.istek()
    # iade sınırı ve tarihi
    istenen = {}
    for k in a["kalemler"]:
        if k["kalem"] > len(asil["kalemler"]):
            raise SenaryoHatasi(f"{a['id']}: asıl faturada {k['kalem']}. kalem yok")
        istenen[k["kalem"]] = istenen.get(k["kalem"], 0) + k["miktar"]
    c.kilit(tarih)
    c.acilis_oncesi(hk, tarih)
    for no, mik in sorted(istenen.items()):
        if mik > asil["kalemler"][no - 1]["miktar"] - asil["iade_edilen"].get(no, 0):
            c.ekle(4, "4xx")
            break
    if tarih < asil["tarih"]:
        c.ekle(4, "4xx")
    c.on_kapi()
    m_top = k_top = t_top = 0
    m_stok = m_hizmet = 0
    ck = asil["cari"]
    satis = asil["tur"] == "satis"
    iade_kalemleri = []
    for no, mik in sorted(istenen.items()):
        ak_kalem = asil["kalemler"][no - 1]
        m, k, t = kalem_hesapla(mik, ak_kalem["fiyat"], ak_kalem["oran"], ak_kalem["iskonto"], ak_kalem["dahil"])
        m_top, k_top, t_top = m_top + m, k_top + k, t_top + t
        if ak_kalem["urun"] is not None:
            m_stok += m
            u = d.urunler[ak_kalem["urun"]]
            u["miktar"] += mik if satis else -mik
            if u["miktar"] < 0:
                raise SenaryoHatasi(f"{a['id']}: stok eksiye düşüyor (BELİRSİZ-14)")
        else:
            m_hizmet += m
        asil["iade_edilen"][no] = asil["iade_edilen"].get(no, 0) + mik
        iade_kalemleri.append({"no": no, "miktar": mik, "M": m, "K": k, "T": t})
    cari_kod = d.cari_kodu(ck)
    if satis:
        satirlar = [("610", "B", m_top, None), ("391", "B", k_top, None), (cari_kod, "A", t_top, ck)]
    else:
        satirlar = [(cari_kod, "B", t_top, ck), ("153", "A", m_stok, None), ("770", "A", m_hizmet, None),
                    ("191", "A", k_top, None)]
    ik = d.yeni_anahtar("F")
    fisler = [d.fis_yaz("iade", tarih, satirlar, c.sira)]
    belge = {"tur": "satis_iade" if satis else "alis_iade", "cari": ck, "tarih": tarih, "sira": c.sira, "M": m_top,
             "K": k_top, "T": t_top, "kalemler": iade_kalemleri, "pesin": 0, "kart": None, "asil": ak,
             "geri": g["yol"], "iade_edilen": {}, "masraf": False}
    d.belgeler[ik] = belge
    c.tanimlar.append(("ad", T_FATURA, ik))
    etki = {}
    if g["yol"] != "acik":
        kod = d.para_kodu(g["yol"], hk)
        if satis:
            gs = [(cari_kod, "B", t_top, ck), (kod, "A", t_top, None)]
            yon = "cikis"
        else:
            gs = [(kod, "B", t_top, None), (cari_kod, "A", t_top, ck)]
            yon = "giris"
        kasa_sirasi_denetle(d, a["id"], tarih, gs)
        fisler.append(d.fis_yaz("iade_geri", tarih, gs, c.sira))
        etki = etki_hesapla(gs)
        d.para.append(para_satiri(d, "iade_geri", yon, g["yol"], hk, ck, t_top, tarih, ("fatura", ik), belge=ik))
    belge["fisler"] = fisler
    eksi_denetle(c, etki, tarih)


def belge_acik_kapasitesi(d, bk, haric=None):
    """Kural 1–4 sonrası (FIFO hariç) belgenin kapatılabilir açığı — BELİRSİZ-10 denetimi için."""
    b = d.belgeler[bk]
    acik = b["T"] - b["pesin"]
    if b["tur"] in ("satis_iade", "alis_iade") and b["geri"] != "acik":
        acik = 0
    for p in d.para:
        if p["etkin"] and p.get("bagli") == bk and p["id"] != haric:
            acik -= p["tutar"]
    return acik


def h_cari_tahsilat_odeme(c):
    a, d = c.a, c.d
    tahsilat = a["islem"] == "cari_tahsilat"
    yol = a["yol"]
    if tahsilat:
        c.yetki("cari_tahsilat")
    else:
        c.yetki("cari_odeme_nakit" if yol == "nakit" else "cari_odeme_banka")
    ck = d.coz(a["cari"], T_CARI)
    bagli = None
    if "kapatilacakFatura" in a:
        bagli = d.coz(a["kapatilacakFatura"], T_FATURA)
        b = d.belgeler[bagli]
        kabul = ("satis", "alis_iade") if tahsilat else ("alis", "satis_iade")
        if b["cari"] != ck or b["tur"] not in kabul or b["kart"] is not None:
            raise SenaryoHatasi(f"{a['id']}: kapatilacakFatura aynı carinin taksitsiz "
                                f"{'alacak' if tahsilat else 'borç'} belgesi olmalı")
    t = c.tutar("tutar", "modul")
    tarih = c.tarih()
    hk = None
    if yol in ("havale", "kart"):
        hk = c.hesap_sec(yol, a.get("hesap"))
    c.istek()
    c.kilit(tarih)
    c.acilis_oncesi(hk, tarih)
    yon = "giris" if tahsilat else "cikis"
    satir = None
    if t is not None and hk is not GECIKME:
        hedef = ("fatura", bagli) if bagli else ("hedefsiz",)
        satir = para_satiri(d, a["islem"], yon, yol, hk, ck, t, tarih, hedef, bagli=bagli)
        benzer_denetle(c, satir)
    c.on_kapi()
    if bagli is not None and t > belge_acik_kapasitesi(d, bagli):
        raise SenaryoHatasi(f"{a['id']}: bağlı tutar belge açığını aşıyor (BELİRSİZ-10)")
    kod = d.para_kodu(yol, hk)
    cari_kod = d.cari_kodu(ck)
    if tahsilat:
        satirlar = [(kod, "B", t, None), (cari_kod, "A", t, ck)]
    else:
        satirlar = [(cari_kod, "B", t, ck), (kod, "A", t, None)]
    kasa_sirasi_denetle(d, a["id"], tarih, satirlar)
    fid = d.fis_yaz(a["islem"], tarih, satirlar, c.sira)
    d.para.append(satir)
    yeni_hareket(c, a["islem"], tarih, [fid], para=[satir["id"]], hesapli=hk is not None)
    eksi_denetle(c, etki_hesapla(satirlar), tarih)


def h_taksit_tahsilat(c):
    a, d = c.a, c.d
    c.yetki("taksit_tahsilat")
    tk = d.coz(a["kart"], T_TAKSIT)
    kart = d.kartlar[tk]
    if "taksitNo" in a and a["taksitNo"] > kart["sayi"]:
        raise SenaryoHatasi(f"{a['id']}: taksitNo kartın taksit sayısını aşıyor")
    t = c.tutar("tutar", None)
    tarih = c.tarih()
    yol = a["yol"]
    hk = c.hesap_sec("havale", a.get("hesap")) if yol == "havale" else None
    c.istek()
    c.kilit(tarih)
    c.acilis_oncesi(hk, tarih)
    ck = kart["cari"]
    satir = None
    if t is not None and hk is not GECIKME:
        hedef = ("taksit", tk, a["taksitNo"]) if "taksitNo" in a else ("kart", tk)
        satir = para_satiri(d, "taksit", "giris", yol, hk, ck, t, tarih, hedef, kart=tk)
        benzer_denetle(c, satir)
    c.on_kapi()
    if t > kart_kalan(d, tk):
        raise SenaryoHatasi(f"{a['id']}: tutar kartın kalanını aşıyor ya da kart kapalı (BELİRSİZ-6)")
    kod = d.para_kodu(yol, hk)
    satirlar = [(kod, "B", t, None), (d.cari_kodu(ck), "A", t, ck)]
    kasa_sirasi_denetle(d, a["id"], tarih, satirlar)
    fid = d.fis_yaz("taksit_tahsilat", tarih, satirlar, c.sira)
    d.para.append(satir)
    yeni_hareket(c, "taksit_tahsilat", tarih, [fid], para=[satir["id"]], hesapli=hk is not None)
    eksi_denetle(c, etki_hesapla(satirlar), tarih)


def kart_odenen(d, tk):
    return sum(p["tutar"] for p in d.para if p["etkin"] and p.get("kart") == tk)


def kart_kalan(d, tk):
    return d.kartlar[tk]["toplam"] - kart_odenen(d, tk)


def h_kasa_banka(c):
    a, d = c.a, c.d
    c.yetki("kasa_banka")
    t = c.tutar("tutar", None)
    tarih = c.tarih()
    hk = c.hesap_sec("havale", a.get("hesap"))
    c.istek()
    c.kilit(tarih)
    c.acilis_oncesi(hk, tarih)
    c.on_kapi()
    if hk is not None and d.hesaplar[hk]["tur"] == "diger":
        raise SenaryoHatasi(f"{a['id']}: Kasa↔Banka'da vadesiz ya da ticari hesap (BELİRSİZ-21)")
    duble_denetle(c, "kasa_banka", tarih, [hk], t)
    kod = d.para_kodu("havale", hk)
    if a["yon"] == "bankadan_kasaya":
        satirlar = [("100", "B", t, None), (kod, "A", t, None)]
    else:
        satirlar = [(kod, "B", t, None), ("100", "A", t, None)]
    kasa_sirasi_denetle(d, a["id"], tarih, satirlar)
    fid = d.fis_yaz("kasa_banka", tarih, satirlar, c.sira)
    yeni_hareket(c, "kasa_banka", tarih, [fid], hesapli=hk is not None, duble=(tarih, [hk], t))
    eksi_denetle(c, etki_hesapla(satirlar), tarih)


def h_transfer(c):
    a, d = c.a, c.d
    c.yetki("transfer")
    kaynak = c.fis_hesabi(a["kaynak"], TUR_102)
    hedef = c.fis_hesabi(a["hedef"], TUR_102)
    tutar = c.tutar("tutar", "banka")
    ucret = None
    if "ucret" in a or "ucretHam" in a:
        ucret = c.tutar("ucret", "banka", sifir_olur=("ucret" in a))      # K2: "0" = ücretsiz
        if ucret and "ucretVergi" not in a:
            c.ekle(2, 400)                                               # K3: §5.6 "ucretVergi eksik"
    tarih = c.tarih()
    if kaynak is not GECIKME and kaynak == hedef:
        c.ekle(2, 400)
    c.istek()
    c.kilit(tarih)
    c.acilis_oncesi(kaynak, tarih)
    c.acilis_oncesi(hedef, tarih)
    c.on_kapi()
    duble_denetle(c, "transfer", tarih, [kaynak, hedef], tutar)
    g = 0
    if ucret:
        u = ucret
        g = u + rh(u * 5, 100) if a["ucretVergi"] == "bsmv_haric" else u
    satirlar = [(d.hesap_alt(hedef), "B", tutar, None), ("770", "B", g, None),
                (d.hesap_alt(kaynak), "A", tutar + g, None)]
    fid = d.fis_yaz("transfer", tarih, satirlar, c.sira)
    yeni_hareket(c, "transfer", tarih, [fid], hesapli=True, duble=(tarih, [kaynak, hedef], tutar))
    eksi_denetle(c, etki_hesapla(satirlar), tarih)


def h_banka_masraf(c):
    a, d = c.a, c.d
    vergi = a["vergi"]
    kdv = vergi.startswith("kdv")
    c.yetki("banka_masraf_kdv" if kdv else "banka_fisi")
    u = c.tutar("tutar", "banka")
    tarih = c.tarih()
    if kdv:
        hk = c.hesap_sec("havale", a["hesap"])
        sk = None
        if "saglayici" not in a:
            c.ekle(2, "4xx")                                             # K3: §4.20 ret tablosu
        else:
            sk = d.coz(a["saglayici"], T_CARI)
    else:
        hk = c.fis_hesabi(a["hesap"], TUR_102)
    c.istek()
    c.kilit(tarih)
    c.acilis_oncesi(hk, tarih)
    c.on_kapi()
    duble_denetle(c, "banka_masraf", tarih, [hk], u)
    alt = d.hesap_alt(hk)
    if not kdv:
        if vergi == "bsmv_dahil":
            gider = rh(u * 100, 105)
            satirlar = [("770", "B", gider, None), ("770", "B", u - gider, None), (alt, "A", u, None)]
        elif vergi == "bsmv_haric":
            bsmv = rh(u * 5, 100)
            satirlar = [("770", "B", u, None), ("770", "B", bsmv, None), (alt, "A", u + bsmv, None)]
        else:
            satirlar = [("770", "B", u, None), (alt, "A", u, None)]
        fid = d.fis_yaz("banka_masraf", tarih, satirlar, c.sira)
        yeni_hareket(c, "banka_masraf", tarih, [fid], hesapli=True, kdv=False, duble=(tarih, [hk], u))
        eksi_denetle(c, etki_hesapla(satirlar), tarih)
        return
    # KDV kipi: alış faturası (hizmet, Banka Masrafları → 770) + peşin havale "tamami" (PLAN §3.7 #13)
    r = a.get("kdvOrani", 20)
    m, k, t = kalem_hesapla(1, u, r, 0, vergi == "kdv_dahil")
    cari_kod = d.cari_kodu(sk)
    satirlar = [("770", "B", m, None), ("191", "B", k, None), (cari_kod, "A", t, sk)]
    bk = d.yeni_anahtar("F")
    f1 = d.fis_yaz("fatura", tarih, satirlar, c.sira)
    ps = [(cari_kod, "B", t, sk), (alt, "A", t, None)]
    f2 = d.fis_yaz("pesin", tarih, ps, c.sira)
    d.belgeler[bk] = {"tur": "alis", "cari": sk, "tarih": tarih, "sira": c.sira, "M": m, "K": k, "T": t,
                      "kalemler": [{"urun": None, "hizmet": "Banka Masrafları", "miktar": 1, "fiyat": u, "oran": r,
                                    "dahil": vergi == "kdv_dahil", "iskonto": 0, "M": m, "K": k, "T": t}],
                      "pesin": t, "kart": None, "asil": None, "geri": None, "iade_edilen": {}, "masraf": True,
                      "fisler": [f1, f2]}
    c.tanimlar.append(("fatura", T_FATURA, bk))
    d.para.append(para_satiri(d, "pesin", "cikis", "havale", hk, sk, t, tarih, ("fatura", bk), belge=bk))
    yeni_hareket(c, "banka_masraf", tarih, [f1, f2], hesapli=True, kdv=True, duble=(tarih, [hk], u))
    eksi_denetle(c, etki_hesapla(ps), tarih)


def h_faiz_geliri(c):
    a, d = c.a, c.d
    c.yetki("banka_fisi")
    hk = c.fis_hesabi(a["hesap"], TUR_102)
    f = c.tutar("brut", "banka")
    tarih = c.tarih()
    c.istek()
    c.kilit(tarih)
    c.acilis_oncesi(hk, tarih)
    c.on_kapi()
    duble_denetle(c, "faiz_geliri", tarih, [hk], f)
    s = rh(f * oran_bp(a["stopajOrani"]), 10000)
    satirlar = [(d.hesap_alt(hk), "B", f - s, None), ("193", "B", s, None), ("642", "A", f, None)]
    fid = d.fis_yaz("faiz_geliri", tarih, satirlar, c.sira)
    yeni_hareket(c, "faiz_geliri", tarih, [fid], hesapli=True, duble=(tarih, [hk], f))
    eksi_denetle(c, etki_hesapla(satirlar), tarih)


def _tek_hesap_fisi(c, islem, satir_kur):
    a, d = c.a, c.d
    c.yetki("banka_fisi")
    hk = c.fis_hesabi(a["hesap"], TUR_102)
    t = c.tutar("tutar", "banka")
    tarih = c.tarih()
    c.istek()
    c.kilit(tarih)
    c.acilis_oncesi(hk, tarih)
    c.on_kapi()
    duble_denetle(c, islem, tarih, [hk], t)
    satirlar = satir_kur(d.hesap_alt(hk), t)
    fid = d.fis_yaz(islem, tarih, satirlar, c.sira)
    yeni_hareket(c, islem, tarih, [fid], hesapli=True, duble=(tarih, [hk], t))
    eksi_denetle(c, etki_hesapla(satirlar), tarih)


def h_faiz_gideri(c):
    _tek_hesap_fisi(c, "faiz_gideri", lambda alt, t: [("780", "B", t, None), (alt, "A", t, None)])


def h_diger_gelir(c):
    _tek_hesap_fisi(c, "diger_gelir", lambda alt, t: [(alt, "B", t, None), ("649", "A", t, None)])


def h_diger_gider(c):
    _tek_hesap_fisi(c, "diger_gider", lambda alt, t: [("659", "B", t, None), (alt, "A", t, None)])


def h_kart_borcu_odeme(c):
    a, d = c.a, c.d
    c.yetki("banka_fisi")
    kaynak = c.fis_hesabi(a["kaynak"], TUR_102)
    kart = c.fis_hesabi(a["kart"], {"kurumsal_kart"})
    t = c.tutar("tutar", "banka")
    tarih = c.tarih()
    c.istek()
    c.kilit(tarih)
    c.acilis_oncesi(kaynak, tarih)
    c.acilis_oncesi(kart, tarih)
    c.on_kapi()
    duble_denetle(c, "kart_borcu_odeme", tarih, [kaynak, kart], t)
    satirlar = [(d.hesap_alt(kart), "B", t, None), (d.hesap_alt(kaynak), "A", t, None)]
    fid = d.fis_yaz("kart_borcu_odeme", tarih, satirlar, c.sira)
    yeni_hareket(c, "kart_borcu_odeme", tarih, [fid], hesapli=True, duble=(tarih, [kaynak, kart], t))
    eksi_denetle(c, etki_hesapla(satirlar), tarih)


def h_kredi_kullanim(c):
    a, d = c.a, c.d
    c.yetki("kredi_kullanim")
    kredi = c.fis_hesabi(a["kredi"], {"kredi"})
    hedef = c.fis_hesabi(a["hedef"], TUR_102)
    t = c.tutar("tutar", "banka")
    tarih = c.tarih()
    c.istek()
    c.kilit(tarih)
    c.acilis_oncesi(kredi, tarih)
    c.acilis_oncesi(hedef, tarih)
    c.on_kapi()
    duble_denetle(c, "kredi_kullanim", tarih, [kredi, hedef], t)
    satirlar = [(d.hesap_alt(hedef), "B", t, None), (d.hesap_alt(kredi), "A", t, None)]
    fid = d.fis_yaz("kredi_kullanim", tarih, satirlar, c.sira)
    yeni_hareket(c, "kredi_kullanim", tarih, [fid], hesapli=True, duble=(tarih, [kredi, hedef], t))
    eksi_denetle(c, etki_hesapla(satirlar), tarih)


def h_kredi_odeme(c):
    a, d = c.a, c.d
    c.yetki("kredi_odeme")
    kredi = c.fis_hesabi(a["kredi"], {"kredi"})
    kaynak = c.fis_hesabi(a["kaynak"], TUR_102)
    anapara = c.tutar("anapara", "banka")
    faiz = 0
    if "faiz" in a or "faizHam" in a:
        faiz = c.tutar("faiz", "banka", sifir_olur=("faiz" in a)) or 0
    tarih = c.tarih()
    c.istek()
    c.kilit(tarih)
    c.acilis_oncesi(kredi, tarih)
    c.acilis_oncesi(kaynak, tarih)
    c.on_kapi()
    duble_denetle(c, "kredi_odeme", tarih, [kredi, kaynak], anapara)
    satirlar = [(d.hesap_alt(kredi), "B", anapara, None), ("780", "B", faiz, None),
                (d.hesap_alt(kaynak), "A", anapara + faiz, None)]
    fid = d.fis_yaz("kredi_odeme", tarih, satirlar, c.sira)
    yeni_hareket(c, "kredi_odeme", tarih, [fid], hesapli=True, duble=(tarih, [kredi, kaynak], anapara))
    eksi_denetle(c, etki_hesapla(satirlar), tarih)


def h_ters_kayit(c):
    a, d = c.a, c.d
    c.yetki("ters_kayit")
    mk = d.coz(a["hedef"], T_HAREKET)
    h = d.hareketler[mk]
    if h["islem"] == "banka_masraf" and h.get("kdv"):
        raise SenaryoHatasi(f"{a['id']}: KDV'li masrafın ters kaydı (BELİRSİZ-16)")
    if h["islem"] in ("kasa_banka", "ters_kayit"):
        raise SenaryoHatasi(f"{a['id']}: {h['islem']} ters kaydı (BELİRSİZ-16)")
    tarih = h["tarih"] if (d.kilit is None or h["tarih"] > d.kilit) else d.bugun
    c.istek()
    if h["islem"] not in TERS_HEDEFLERI:
        c.ekle(4, "4xx")                                             # ters kaydedilemeyen hedef
    elif h["ters"] is not None:
        c.ekle(4, 409)                                               # ters kaydı iki kez
    c.kilit(tarih)
    c.on_kapi()
    satirlar = []
    for fid in h["fisler"]:
        for k, t, u, cc in d.fis(fid)["satirlar"]:
            satirlar.append((k, "A" if t == "B" else "B", u, cc))
    fid = d.fis_yaz("ters", tarih, satirlar, c.sira)
    h["ters"] = fid
    yeni_hareket(c, "ters_kayit", tarih, [fid], hesapli=True, hedef=mk)
    eksi_denetle(c, etki_hesapla(satirlar), tarih)


def h_sil(c):
    a, d = c.a, c.d
    mk = d.coz(a["hedef"], T_HAREKET)
    h = d.hareketler[mk]
    if h["islem"] in SIL_HEDEFLERI:
        if h.get("hesapli"):
            c.yetki("sil_bagli")
        elif h["kullanici"] == c.kullanici:
            c.yetki("sil_nakit_kendi")
        else:
            c.yetki("sil_nakit_baska")
    else:
        c.yetki("sil_bagli")
    c.istek()
    if h["islem"] not in SIL_HEDEFLERI:
        c.ekle(4, "4xx")                                             # Banka Fişi / transfer silinmez
    elif h["silindi"]:
        c.ekle(4, 404)
    c.kilit(h["tarih"])
    c.on_kapi()
    satirlar = []
    for fid in h["fisler"]:
        f = d.fis(fid)
        f["etkin"] = False
        satirlar.extend(f["satirlar"])
    h["silindi"] = True
    for pid in h.get("para", []):
        for p in d.para:
            if p["id"] == pid:
                p["etkin"] = False
    eksi_denetle(c, etki_hesapla(satirlar, isaret=-1), h["tarih"])


ISLEYICI = {
    "ayar": h_ayar, "donem_kilidi": h_donem_kilidi, "hesap_ac": h_hesap_ac, "hesap_durum": h_hesap_durum,
    "hesap_eksi_politika": h_hesap_eksi_politika, "acilis_duzelt": h_acilis_duzelt, "kasa_acilis": h_kasa_acilis,
    "kasa_hareket": h_kasa_hareket, "cari_ac": h_cari_ac, "urun_ac": h_urun_ac, "stok_giris": h_stok_giris,
    "fatura": h_fatura, "iade": h_iade, "cari_tahsilat": h_cari_tahsilat_odeme, "cari_odeme": h_cari_tahsilat_odeme,
    "taksit_tahsilat": h_taksit_tahsilat, "kasa_banka": h_kasa_banka, "transfer": h_transfer,
    "banka_masraf": h_banka_masraf, "faiz_geliri": h_faiz_geliri, "faiz_gideri": h_faiz_gideri,
    "diger_gelir": h_diger_gelir, "diger_gider": h_diger_gider, "kart_borcu_odeme": h_kart_borcu_odeme,
    "kredi_kullanim": h_kredi_kullanim, "kredi_odeme": h_kredi_odeme, "ters_kayit": h_ters_kayit, "sil": h_sil,
}

# Adımın tanımladığı takma adlar (yineleme ve atlama için): alan yolu → değer
def tanimlanan_adlar(a):
    adlar = []
    if "ad" in a:
        adlar.append(("ad", a["ad"]))
    if a["islem"] == "fatura" and isinstance(a.get("odeme"), dict) and "taksit" in a["odeme"]:
        adlar.append(("odeme.taksit.ad", a["odeme"]["taksit"]["ad"]))
    if a["islem"] == "banka_masraf" and "fatura" in a:
        adlar.append(("fatura", a["fatura"]))
    return adlar


# Adımın andığı takma adlar (atlananlar için): (ad, tür)
def anilan_adlar(a):
    op = a["islem"]
    r = []
    for alan in ("hesap", "kaynak", "hedef", "kredi"):
        if alan in a and op not in ("ters_kayit", "sil"):
            r.append((a[alan], T_HESAP))
    if op == "kart_borcu_odeme":
        r.append((a["kart"], T_HESAP))
    if op == "taksit_tahsilat":
        r.append((a["kart"], T_TAKSIT))
    if op in ("ters_kayit", "sil"):
        r.append((a["hedef"], T_HAREKET))
    for alan in ("cari", "saglayici"):
        if alan in a:
            r.append((a[alan], T_CARI))
    if "urun" in a:
        r.append((a["urun"], T_URUN))
    for alan in ("asilFatura", "kapatilacakFatura"):
        if alan in a:
            r.append((a[alan], T_FATURA))
    if op == "fatura":
        for k in a["kalemler"]:
            if "urun" in k:
                r.append((k["urun"], T_URUN))
        for p in (a.get("odeme") or {}).get("pesin", []):
            if "hesap" in p:
                r.append((p["hesap"], T_HESAP))
    if op == "iade" and "hesap" in a["geri"]:
        r.append((a["geri"]["hesap"], T_HESAP))
    return r


# ────────────────────────────────────────────────────────────────────────── fatura açığı (§7) ve çıktı

def faturalari_hesapla(d):
    """SENARYO-DILI §7 kuralları 1–6; dönüş: (açıklar, belirsiz cariler, dağıtılmamış giriş/çıkış)."""
    acik = {bk: b["T"] for bk, b in d.belgeler.items()}
    # 1 peşin
    for bk, b in d.belgeler.items():
        acik[bk] -= b["pesin"]
    # 2 iade geri ödemesi
    for bk, b in d.belgeler.items():
        if b["tur"] in ("satis_iade", "alis_iade") and b["geri"] != "acik":
            acik[bk] = 0
    # 3 taksitli satış faturası = kart kalanı
    for bk, b in d.belgeler.items():
        if b["kart"] is not None:
            acik[bk] = kart_kalan(d, b["kart"])
    # 4 bağlı satırlar
    for p in d.para:
        if p["etkin"] and p.get("bagli"):
            acik[p["bagli"]] -= p["tutar"]
            if acik[p["bagli"]] < 0:
                raise KahinHatasi("bağlı satır belge açığını aşıyor (BELİRSİZ-10 denetimi kaçırdı)")
    # 5 geri ödenmemiş iade (K5: iadenin 1–4 sonrası kalanı)
    iadeler = sorted((b["tarih"], b["sira"], bk) for bk, b in d.belgeler.items()
                     if b["tur"] in ("satis_iade", "alis_iade") and b["geri"] == "acik")
    for _, _, ik in iadeler:
        asil = d.belgeler[ik]["asil"]
        x = min(acik[ik], acik[asil])
        acik[asil] -= x
        acik[ik] -= x
    # 6 bağsız satırlar FIFO
    dagitilmamis = {}
    for ck in d.cariler:
        giris = sum(p["tutar"] for p in d.para if p["etkin"] and p["cari"] == ck and p["tur"] == "cari_tahsilat"
                    and not p.get("bagli"))
        cikis = sum(p["tutar"] for p in d.para if p["etkin"] and p["cari"] == ck and p["tur"] == "cari_odeme"
                    and not p.get("bagli"))
        alacak = sorted((b["tarih"], b["sira"], bk) for bk, b in d.belgeler.items()
                        if b["cari"] == ck and b["tur"] in ("satis", "alis_iade") and b["kart"] is None)
        borc = sorted((b["tarih"], b["sira"], bk) for bk, b in d.belgeler.items()
                      if b["cari"] == ck and b["tur"] in ("alis", "satis_iade"))
        for _, _, bk in alacak:
            al = min(giris, acik[bk])
            acik[bk] -= al
            giris -= al
        for _, _, bk in borc:
            al = min(cikis, acik[bk])
            acik[bk] -= al
            cikis -= al
        dagitilmamis[ck] = (giris, cikis)
    for bk, v in acik.items():
        if v < 0:
            raise KahinHatasi(f"belge açığı eksi: {bk} {v}")
    # belirsiz cariler (§7 Kesinlik)
    belirsiz = {}
    for ck in d.cariler:
        belgeler = [b for b in d.belgeler.values() if b["cari"] == ck]
        bagsiz_giris = any(p["etkin"] and p["cari"] == ck and p["tur"] == "cari_tahsilat" and not p.get("bagli")
                           for p in d.para)
        bagsiz_cikis = any(p["etkin"] and p["cari"] == ck and p["tur"] == "cari_odeme" and not p.get("bagli")
                           for p in d.para)
        nedenler = []
        if bagsiz_giris and any(b["kart"] is not None for b in belgeler):
            nedenler.append("BELİRSİZ-7")
        if (bagsiz_giris or bagsiz_cikis) and any(b["tur"] in ("satis_iade", "alis_iade") and b["geri"] == "acik"
                                                  for b in belgeler):
            nedenler.append("BELİRSİZ-9")
        if (bagsiz_giris and any(b["tur"] in ("alis", "satis_iade") for b in belgeler)) or \
                (bagsiz_cikis and any(b["tur"] in ("satis", "alis_iade") for b in belgeler)):
            nedenler.append("BELİRSİZ-11")
        if nedenler:
            belirsiz[ck] = nedenler[0]
    # değişmez: cariBakiye = Σ açık(alacak) − Σ açık(borç) − dağıtılmamış giriş + dağıtılmamış çıkış
    for ck in d.cariler:
        bakiye = d.bakiye(d.cari_kodu(ck), cari=ck)
        al = sum(acik[bk] for bk, b in d.belgeler.items() if b["cari"] == ck and b["tur"] in ("satis", "alis_iade"))
        bo = sum(acik[bk] for bk, b in d.belgeler.items() if b["cari"] == ck and b["tur"] in ("alis", "satis_iade"))
        g, c_ = dagitilmamis[ck]
        if bakiye != al - bo - g + c_:
            raise KahinHatasi(f"cari değişmezi bozuk ({ck}): bakiye {bakiye} ≠ {al} − {bo} − {g} + {c_}")
    return acik, belirsiz


def anlik(d):
    """Bir andaki karşılaştırılan alanlar (§8.1–8.4) + o anın belirsiz yolları."""
    mizan = {}
    kodlar = d.hesap_kodu_hareketli()
    toplam_b = toplam_a = 0
    for kod in sorted(kodlar):
        b = d.bakiye(kod)
        mizan[kod] = {"borc": max(0, b), "alacak": max(0, -b)}
        toplam_b += mizan[kod]["borc"]
        toplam_a += mizan[kod]["alacak"]
    if toplam_b != toplam_a:
        raise KahinHatasi(f"mizan dengesiz: borç {toplam_b} ≠ alacak {toplam_a}")
    # her fişin dengesini yeniden doğrula
    for f in d.fisler:
        bb = sum(s[2] for s in f["satirlar"] if s[1] == "B")
        aa = sum(s[2] for s in f["satirlar"] if s[1] == "A")
        if bb != aa:
            raise KahinHatasi(f"fiş dengesiz: {f['id']}")

    def takmalar(tur):
        return sorted((ad, k) for ad, (t, k) in d.takma.items() if t == tur)

    banka = {ad: d.bakiye(d.hesaplar[hk]["alt"]) for ad, hk in takmalar(T_HESAP)}
    kodlari = {ad: d.hesaplar[hk]["alt"] for ad, hk in takmalar(T_HESAP)}
    eksi = {ad: d.etkin_politika(hk) for ad, hk in takmalar(T_HESAP)}
    cariler = {ad: d.bakiye(d.cari_kodu(ck), cari=ck) for ad, ck in takmalar(T_CARI)}
    stok = {ad: d.urunler[uk]["miktar"] for ad, uk in takmalar(T_URUN)}
    acik, belirsiz_cari = faturalari_hesapla(d)
    faturalar = {ad: {"toplam": d.belgeler[bk]["T"], "matrah": d.belgeler[bk]["M"], "kdv": d.belgeler[bk]["K"],
                      "acik": acik[bk]} for ad, bk in takmalar(T_FATURA)}
    kartlar = {}
    for ad, tk in takmalar(T_TAKSIT):
        od = kart_odenen(d, tk)
        kartlar[ad] = {"toplam": d.kartlar[tk]["toplam"], "odenen": od, "kalan": d.kartlar[tk]["toplam"] - od}
    gercek = sum(d.bakiye(h["alt"]) for h in d.hesaplar.values() if h["ana"] == "102")
    atanmamis = d.bakiye("102.00") + d.bakiye("108.00")
    borc = -sum(d.bakiye(h["alt"]) for h in d.hesaplar.values() if h["ana"] in ("309", "300"))
    kasa = d.bakiye("100")
    for u in d.urunler.values():
        if u["miktar"] < 0:
            raise KahinHatasi("stok eksi")
    durum = {
        "mizan": mizan, "bankaHesaplari": banka, "kasa": kasa, "cariler": cariler, "stok": stok,
        "faturalar": faturalar, "taksitKartlari": kartlar, "hesapKodlari": kodlari, "eksiBakiyeDenetimi": eksi,
        "ozet": {"gercekBanka": gercek, "hesabiAtanmamis": atanmamis, "kartVeKrediBorcu": borc,
                 "kasaVeGercekBanka": kasa + gercek},
    }
    belirsiz = []
    for ad, bk in takmalar(T_FATURA):
        ck = d.belgeler[bk]["cari"]
        if ck in belirsiz_cari:
            belirsiz.append((f"faturalar.{ad}.acik", belirsiz_cari[ck]))
    for ad, tk in takmalar(T_TAKSIT):
        ck = d.kartlar[tk]["cari"]
        if ck in belirsiz_cari:
            for alan in ("toplam", "odenen", "kalan"):
                belirsiz.append((f"taksitKartlari.{ad}.{alan}", belirsiz_cari[ck]))
    if any(u["alis"] and u["satis"] for u in d.urunler.values()):          # BELİRSİZ-15 (K26)
        belirsiz.append(("mizan.153", "BELİRSİZ-15"))
        belirsiz.append(("mizan.621", "BELİRSİZ-15"))
    return durum, belirsiz


# ────────────────────────────────────────────────────────────────────────────────────────── koşucu

def adim_isle(d, a, sira):
    """Bir adımı d üzerinde uygular; d'yi (yeni durum) döndürür."""
    op = a["islem"]
    if op == "kontrol":
        durum, belirsiz = anlik(d)
        d.ara[a["id"]] = durum
        d.ara_belirsiz[a["id"]] = belirsiz
        return d
    if op == "saat":
        d.bugun = tarih_coz(a["bugun"])
        return d
    for ad, tur in anilan_adlar(a):
        if ad not in d.takma:
            d.atlananlar.append((sira, a["id"]))
            return d
    yeni = copy.deepcopy(d)
    c = Baglam(yeni, a, sira)
    try:
        ISLEYICI[op](c)
    except Ret as r:
        d.retler.append((sira, {"adim": a["id"], "durum": r.durum, "kod": r.kod, "kodDayanak": r.dayanak}))
        if r.coklu:
            d.ret_belirsiz.append((f"retler.{a['id']}", "BELİRSİZ-17"))
        return d
    except Yineleme as y:
        d.yinelenenler.append((sira, a["id"]))
        onceki = dict((alan, (tur, k)) for alan, tur, k in y.kayit["tanimlar"])
        for alan, ad in tanimlanan_adlar(a):
            if alan in onceki:
                d.takma_ver(ad, onceki[alan][0], onceki[alan][1])
        return d
    except Atla:
        d.atlananlar.append((sira, a["id"]))
        return d
    # başarı: takma adlar ve istek kimliği
    tanim_alan = dict(tanimlanan_adlar(a))
    for alan, tur, k in c.tanimlar:
        if alan in tanim_alan:
            yeni.takma_ver(tanim_alan[alan], tur, k)
    if "istekKimligi" in a:
        yeni.istekler[(c.kullanici, op, a["istekKimligi"])] = {"govde": govde(a), "tanimlar": c.tanimlar,
                                                               "adim": a["id"]}
    return yeni


def parmak_izi(d):
    return json.dumps(cikti_alanlari(d), sort_keys=True, ensure_ascii=False) + "|" + json.dumps(
        sorted((ad, t, k) for ad, (t, k) in d.takma.items())) + "|" + json.dumps(
        sorted((k, h["silindi"], h["ters"] is not None) for k, h in d.hareketler.items()))


def cikti_alanlari(d):
    durum, belirsiz = anlik(d)
    durum["retler"] = [r for _, r in sorted(d.retler, key=lambda x: x[0])]
    durum["yinelenenler"] = [i for _, i in sorted(d.yinelenenler)]
    durum["atlananlar"] = [i for _, i in sorted(d.atlananlar)]
    durum["araDurumlar"] = d.ara
    tum = list(belirsiz) + list(d.ret_belirsiz)
    for kid, bl in d.ara_belirsiz.items():
        tum.extend((f"araDurumlar.{kid}.{yol}", neden) for yol, neden in bl)
    durum["belirsizler"] = [{"alan": y, "neden": n} for y, n in sorted(set(tum))]
    return durum


def kos(sen, dosya_adi):
    bugun, kullanicilar = senaryo_dogrula(sen, dosya_adi)
    d0 = Durum(bugun, kullanicilar, sen["baslangic"].get("ayarlar", {}))
    adimlar = sen["adimlar"]
    durumlar = [d0]
    grup_var = False
    i = 0
    while i < len(adimlar):
        g = adimlar[i].get("ayniAnda")
        if g is None:
            durumlar = [adim_isle(d, adimlar[i], i) for d in durumlar]
            i += 1
            continue
        grup_var = True
        j = i
        while j < len(adimlar) and adimlar[j].get("ayniAnda") == g:
            j += 1
        uyeler = list(range(i, j))
        yeni = {}
        for d in durumlar:
            for sira in itertools.permutations(uyeler):
                dd = copy.deepcopy(d)
                for k in sira:
                    dd = adim_isle(dd, adimlar[k], k)
                yeni.setdefault(parmak_izi(dd), dd)
        durumlar = [yeni[k] for k in sorted(yeni)]
        i = j
    ust = {"dil": DIL, "senaryo": sen["ad"], "kaynak": "kahin"}
    if not grup_var:
        ust.update(cikti_alanlari(durumlar[0]))
        return ust
    alternatifler = {}
    for d in durumlar:
        cik = cikti_alanlari(d)
        alternatifler[json.dumps(cik, sort_keys=True, ensure_ascii=False)] = cik
    ust["alternatifler"] = [alternatifler[k] for k in sorted(alternatifler)]
    birlesik = set()
    for alt in ust["alternatifler"]:
        for b in alt["belirsizler"]:
            birlesik.add((b["alan"], b["neden"]))
    ust["belirsizler"] = [{"alan": y, "neden": n} for y, n in sorted(birlesik)]
    return ust


def plan_karsilastir(cikti, sen):
    """SENARYO-DILI §9/1: her kontrol adımındaki planBeklenen yaprağı ↔ kâhinin araDurumlar değeri (tam eşitlik).
    Yollar demet olarak yürünür (mizan anahtarı "102.01" nokta içerir). `mizan`da eksik hesap {0, 0} sayılır.
    Dönüş: (karşılaştırılan yaprak sayısı, farklar). Alternatifli çıktıda her alternatif ayrı denetlenir."""
    def yapraklar(nesne, yol=()):
        if isinstance(nesne, dict) and nesne:
            for k, v in nesne.items():
                yield from yapraklar(v, yol + (k,))
        else:
            yield yol, nesne

    def al(nesne, yol):
        for i, parca in enumerate(yol):
            if not isinstance(nesne, dict) or parca not in nesne:
                if yol[0] == "mizan" and i <= 2:
                    return 0
                return "<yok>"
            nesne = nesne[parca]
        return nesne

    alternatifler = cikti.get("alternatifler") or [cikti]
    sayi, farklar = 0, []
    for alt in alternatifler:
        for a in sen["adimlar"]:
            if a["islem"] != "kontrol" or "planBeklenen" not in a:
                continue
            ara = alt["araDurumlar"].get(a["id"])
            for yol, beklenen in yapraklar(a["planBeklenen"]):
                sayi += 1
                gercek = "<kontrol yok>" if ara is None else al(ara, yol)
                if gercek != beklenen:
                    farklar.append((a["id"], ".".join(yol), beklenen, gercek))
    return sayi, farklar


def ana(argv):
    if len(argv) != 2:
        sys.stderr.write("kullanım: python3 -I model.py <senaryo.json>\n")
        return 2
    yol = argv[1]
    try:
        with open(yol, encoding="utf-8") as f:
            sen = json.load(f)
        cikti = kos(sen, yol)
    except SenaryoHatasi as e:
        sys.stderr.write(json.dumps({"hata": "senaryo-gecersiz", "neden": str(e)}, ensure_ascii=False) + "\n")
        return 2
    except KahinHatasi as e:
        sys.stderr.write(json.dumps({"hata": "kahin-degismez", "neden": str(e)}, ensure_ascii=False) + "\n")
        return 3
    except (OSError, json.JSONDecodeError) as e:
        sys.stderr.write(json.dumps({"hata": "dosya", "neden": str(e)}, ensure_ascii=False) + "\n")
        return 2
    sys.stdout.write(json.dumps(cikti, sort_keys=True, indent=2, ensure_ascii=False) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(ana(sys.argv))
