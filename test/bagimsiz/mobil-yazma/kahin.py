#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""DestekOfis 2.4.7 M5 — mobilden yazma (tahsilat / ödeme / stok) bağımsız kâhini. Temiz oda: programın kodu GÖRÜLMEDEN, yalnız karar
metinlerinden (README.md "Kaynaklar") yazıldı. Para anlamı (cari bakiye, fatura kapama FIFO / Kapatılacak Fatura, çek/senet) mevcut bağımsız
CARİ kâhinine (test/bagimsiz/cari/model.py, kural seti 2.4.6) DEVREDİLİR: mobil ya da masaüstü kanaldan kabul edilen her para isteği o
kâhinin AYNI olayına çevrilir (eşdeğerlik). Bu dosya cari kâhinini DEĞİŞTİRMEZ, yalnız içe aktarır; mobil kapılar (sunucu, kesinti, cihaz,
uzak izni, lisans, şirket yetkisi, istek kimliği, yollar), Kasa / Banka / POS / kurumsal kart hesapları, taksit kartı (K8) ve stok bu dosyada.

  python3 -I kahin.py hesapla <senaryo.json> [--param ad=deger …] [--mutasyon N]
  python3 -I kahin.py karsilastir <kabul.json> <program.json> [--birlesim "<ad=deger;…>"]
  python3 -I kahin.py --mutasyonlar

Yalnız standart kütüphane, yalnız tamsayı kuruş; saat = senaryonun sahte saati (sistem saati okunmaz); aynı girdiye bayt bayt aynı çıktı.
"""
import copy
import importlib.util
import itertools
import json
import os
import re
import sys
from datetime import date, datetime, timedelta, timezone

sys.dont_write_bytecode = True
_BURASI = os.path.dirname(os.path.abspath(__file__))
_CARI_YOL = os.path.normpath(os.path.join(_BURASI, "..", "cari", "model.py"))


def _cari_modulu():
    spec = importlib.util.spec_from_file_location("destekofis_cari_kahini", _CARI_YOL)
    modul = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modul)
    return modul


CARI = _cari_modulu()
CARI_KURAL = "2.4.6"

DIL = "destekofis-mobil-yazma/1"
TR = timezone(timedelta(hours=3))  # V1: Türkiye sabit UTC+3

# Metnin sustuğu kurallar PARAMETREDİR (ders 40, 43); seçim kullanıcının. README "AÇIK SORULAR" S1–S8.
PARAMETRELER = {
    "kapatilacak": ("secilir", "yalniz_fifo"),        # S1 mobilde Kapatılacak Fatura
    "yollar": ("nakit_havale_pos", "evrak_dahil"),    # S2 mobil tahsilat yolları (çek/senet)
    "taksit": ("kart_secilir", "yalniz_cari"),        # S3 mobilden taksit kartına tahsilat
    "onay": ("sorar", "gecemez"),                     # S4 mobilde "Yine de Kaydet" / Benzer İşlem onayı / Fazlasını Avans Yaz
    "eksi_stok": ("sorar", "gecemez"),                # S5 mobilde eksi stok sorusu
    "tarih": ("sunucu_gunu", "form_tarihi"),          # S6 mobil işlemin tarihi
    "gec_yeniden": ("sunucu_karar", "telefon_24s"),   # S7 sonucu belirsiz isteğin geç yeniden gönderimi
    "stok_yonu": ("giris_cikis", "yalniz_giris"),     # S8 mobil stok hareketi yönü
}
ONERI = {"kapatilacak": "yalniz_fifo", "yollar": "nakit_havale_pos", "taksit": "kart_secilir", "onay": "sorar",
         "eksi_stok": "sorar", "tarih": "sunucu_gunu", "gec_yeniden": "telefon_24s", "stok_yonu": "yalniz_giris"}

MUTASYONLAR = {
    1: "Kesintiden sonra yeniden gönderim istek kimliğiyle tanınmaz (ikinci kayıt)",
    2: "Aynı kimlik + farklı gövde 409 yerine 'zaten kaydedildi' sayılır",
    3: "Aynı kimlik + farklı gövde yeni kayıt açar",
    4: "İstek kimliği anahtarında kullanıcı yok (iki kullanıcının aynı kimliği tek kayıt)",
    5: "İstek kimliği anahtarında şirket yok (iki şirketin aynı kimliği tek kayıt)",
    6: "Reddedilen isteğin kimliği hatırlanır (düzeltilip yeniden gönderilen istek yazılmaz)",
    7: "Sunucu kapalıyken girilen mobil istek kuyruğa alınır, sunucu açılınca yazılır",
    8: "Silinmiş cihaz yazabilir",
    9: "Uzaktan Bağlanabilir izni kaldırılınca cihazlar düşmez ve izin denetlenmez (cihaz yazmayı sürdürür)",
    10: "Lisans bitince mobil yazma sürer",
    11: "Mobilde şirket yetkisi denetlenmez",
    12: "Başka şirketin cari kimliği o carinin şirketine yazılır",
    13: "POS tahsilatı Kasa'ya girer",
    14: "Havale Kasa'ya girer",
    15: "Mobil bağsız tahsilat en YENİ faturaya bağlanır (FIFO değil)",
    16: "Mobilde Kapatılacak Fatura yok sayılır (FIFO'ya döner)",
    17: "Yalnız FIFO kipinde mobil fatura alanı kabul edilir",
    18: "K8: kalanı aşan taksit tahsilatı karta yazılır (plan-overpay yok)",
    19: "K8: kapanmış karta tahsilat kabul edilir (plan-paid yok)",
    20: "Fazlasını Avans Yaz yetkisiz kullanıcıda geçer",
    21: "Mobil stok çıkışı soru sormadan eksiye düşer",
    22: "Eksi stok 'geçemez' kipinde mobil onay yine geçer",
    23: "Mobil nakit ödemede Kasa eksi bakiye denetimi yok",
    24: "Mobil işlemin günü UTC'den alınır",
    25: "Kesinti 'önce' yeniden gönderiminde gün ilk denemenin günüdür (sunucu günü kipinde)",
    26: "Mobilde dönem kilidi denetlenmez",
    27: "Mobilde ileri tarih denetlenmez",
    28: "Mobilde rol yetkisi denetlenmez",
    29: "Mobil stok girişi iki kez yazılır",
    30: "Mobil stok çıkışı giriş gibi yazılır",
    31: "Aynı anda gelen iki taksit tahsilatı aynı eski kalanla denetlenir (kilitsiz yarış)",
    32: "Yedekten geri yüklemede istek kimlikleri geri yüklenmez (yeniden gönderim 'zaten kaydedildi' der, kayıt yok)",
    33: "İstek kimliği 1 günde budanır (30 gün yerine)",
    34: "'Telefon 24 saat' kipinde eski belirsiz istek yine gönderilir",
    35: "Kesinti 'önce' (sunucuya ulaşmayan) istek yazılmış sayılır",
    36: "Mobil ödeme tahsilat yönünde işlenir",
    37: "Çek/senet tahsilatı Kasa'ya girer",
    38: "Evrak kapalı kipte mobil çek/senet kabul edilir",
    39: "Mobil isteğin şirketi yok sayılır (hep 001)",
    40: "Mobilde Benzer İşlem denetimi yok",
    41: "Silinen cihazın yerine eşlenen yeni cihaz da yazamaz",
    42: "Şirket yetkisi değişikliği mobilde uygulanmaz (eşleme anındaki yetki sürer)",
    43: "Mobil havale/POS hesap seçimi kuralı yok (hep hesapsız 102.00/108.00)",
    44: "Taksit kartında ödeme en YENİ taksitten sayılır",
    45: "Sunucu günü kipinde telefonun form tarihi kullanılır",
    46: "Yalnız giriş kipinde mobil stok çıkışı kabul edilir",
    47: "Yalnız cari kipinde mobil taksit kartı tahsilatı kabul edilir",
    48: "Kesinti 'sonra' (yazılmış) istek yazılmamış sayılır (kayıt düşer)",
}

PARA_ISLEM = ("tahsilat", "odeme", "stok")
KURULUM = ("cari_ac", "fatura", "iade", "kart_ac", "hesap_ac", "urun_ac", "kasa_acilis", "cari_sil", "donem_kilitle", "yedek_al",
           "yedek_geri_yukle", "sirket_ac", "ayar")
ORTAM = ("saat", "sunucu", "cihaz_esle", "cihaz_sil", "uzak_izin", "sirket_yetki", "lisans", "surum_yukselt")
ISLEMLER = PARA_ISLEM + KURULUM + ORTAM + ("yeniden_gonder", "kontrol")
TAHSILAT_YOLLARI = ("nakit", "havale", "pos", "cek", "senet")
ODEME_YOLLARI = ("nakit", "havale", "kart")
ROLLER = ("yonetici", "muhasebe", "personel")
KIMLIK_OMRU = timedelta(days=30)        # PLAN §3.10/1 "30 günden eskiler budanır"
TELEFON_OMRU = timedelta(hours=24)      # S7 seçeneği "telefon_24s"
TUTAR_RE = re.compile(r"^[0-9]{1,13}(,[0-9]{1,2})?$")
TAKMA_RE = re.compile(r"^[A-Z][A-Z0-9_]{0,15}$")
ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,40}$")


class SenaryoHatasi(Exception):
    """Senaryo dilin dışında (ders 3/4: sessizce atlanmaz)."""


class _Catal(Exception):
    """İstek kimliğinin budanıp budanmadığı metinde belirsiz (budama zamanı yazılı değil) → iki dünya."""


# ───────────────────────────────────────────────── yardımcılar
def birlesim_adi(p):
    return ";".join("%s=%s" % (k, p[k]) for k in PARAMETRELER)


def birlesim_coz(metin):
    p = dict(ONERI)
    for parca in [x for x in metin.split(";") if x.strip()]:
        k, _, v = parca.partition("=")
        k, v = k.strip(), v.strip()
        if k not in PARAMETRELER or v not in PARAMETRELER[k]:
            raise SenaryoHatasi("bilinmeyen parametre/değer: %s" % parca)
        p[k] = v
    return p


def birlesimler():
    for degerler in itertools.product(*PARAMETRELER.values()):
        yield dict(zip(PARAMETRELER, degerler))


def zaman(metin):
    try:
        z = datetime.fromisoformat(metin)
    except (TypeError, ValueError):
        raise SenaryoHatasi("saat biçimi geçersiz: %r" % (metin,))
    if z.tzinfo is None:
        z = z.replace(tzinfo=TR)
    return z.astimezone(TR)


def gun(z, utc=False):
    return (z.astimezone(timezone.utc) if utc else z.astimezone(TR)).date().isoformat()


def tarih_gecerli(v):
    if not isinstance(v, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", v):
        return False
    try:
        date.fromisoformat(v)
    except ValueError:
        return False
    return True


def kurus(metin):
    """PLAN §9.2/9 tutar: 0 < tutar ≤ 1e12 TL, en çok 2 ondalık, virgül ayırıcı. Geçersiz → None (400)."""
    if not isinstance(metin, str) or not TUTAR_RE.match(metin):
        return None
    tam, _, ond = metin.partition(",")
    k = int(tam) * 100 + (int((ond + "00")[:2]) if ond else 0)
    if k <= 0 or k > 1_000_000_000_000 * 100:
        return None
    return k


def tl(k):
    return "%d,%02d" % (k // 100, k % 100)


def miktar_coz(v):
    """Miktar tamsayı ≥ 1 (Adet; ondalık miktar bu dil sürümünde YOK — README V9)."""
    if isinstance(v, bool) or not isinstance(v, int) or v < 1 or v > 10**9:
        return None
    return v


# ───────────────────────────────────────────────── senaryo doğrulama
def dogrula(s):
    if not isinstance(s, dict) or s.get("dil") != DIL:
        raise SenaryoHatasi("dil %s değil" % DIL)
    if not isinstance(s.get("ad"), str) or not s["ad"]:
        raise SenaryoHatasi("ad yok")
    b = s.get("baslangic")
    if not isinstance(b, dict) or "simdi" not in b:
        raise SenaryoHatasi("baslangic.simdi yok")
    zaman(b["simdi"])
    for kod, ayar in (b.get("sirketler") or {"001": {}}).items():
        if kod not in ("001", "002"):
            raise SenaryoHatasi("şirket kodu 001/002 olmalı (en çok 2 şirket): %s" % kod)
        if (ayar or {}).get("kasaEksi", "kontrol_yok") not in ("kontrol_yok", "uyar", "engelle"):
            raise SenaryoHatasi("kasaEksi geçersiz")
    for ad, u in (b.get("kullanicilar") or {}).items():
        if u.get("rol") not in ROLLER:
            raise SenaryoHatasi("rol geçersiz: %s" % ad)
    ids, takma = set(), set()
    adimlar = s.get("adimlar")
    if not isinstance(adimlar, list):
        raise SenaryoHatasi("adimlar yok")
    yukseldi = b.get("kaynakSurum") is None
    for i, a in enumerate(adimlar):
        if not isinstance(a, dict) or a.get("islem") not in ISLEMLER:
            raise SenaryoHatasi("bilinmeyen islem: %r" % (a.get("islem") if isinstance(a, dict) else a))
        if not ID_RE.match(str(a.get("id", ""))) or a["id"] in ids:
            raise SenaryoHatasi("adım id geçersiz ya da tekrar: %r" % a.get("id"))
        ids.add(a["id"])
        if a.get("ad") is not None and a["islem"] in ("cari_ac", "fatura", "iade", "kart_ac", "hesap_ac", "urun_ac"):
            if not TAKMA_RE.match(a["ad"]) or a["ad"] in takma:
                raise SenaryoHatasi("takma ad geçersiz ya da tekrar: %r" % a["ad"])
            takma.add(a["ad"])
        if a["islem"] == "surum_yukselt":
            yukseldi = True
        if a["islem"] in PARA_ISLEM:
            if a.get("kanal") not in ("mobil", "masaustu"):
                raise SenaryoHatasi("%s: kanal mobil/masaustu olmalı" % a["id"])
            if a["kanal"] == "mobil" and not a.get("cihaz"):
                raise SenaryoHatasi("%s: mobil adımda cihaz yok" % a["id"])
            if a["kanal"] == "mobil" and a.get("kullanici"):
                raise SenaryoHatasi("%s: mobil adımda kullanıcı cihazdan gelir (kullanici yazılmaz)" % a["id"])
            if not a.get("istekKimligi"):
                raise SenaryoHatasi("%s: istekKimligi yok (PLAN §3.10/1 form açılışında üretilir)" % a["id"])
            if a.get("kesinti") not in (None, "once", "sonra"):
                raise SenaryoHatasi("%s: kesinti once/sonra" % a["id"])
            if not yukseldi and a["kanal"] == "mobil":
                raise SenaryoHatasi("%s: eski sürüm (kaynakSurum) adımı mobil olamaz" % a["id"])
        if a["islem"] == "yeniden_gonder" and a.get("adim") not in ids:
            raise SenaryoHatasi("%s: yeniden_gonder önceki bir adımı anmalı" % a["id"])
        if a.get("ayniAnda") and a["islem"] not in PARA_ISLEM:
            raise SenaryoHatasi("%s: ayniAnda yalnız para/stok adımında" % a["id"])
    # ayniAnda: ardışık, en çok 4, kesintisiz
    i = 0
    while i < len(adimlar):
        g = adimlar[i].get("ayniAnda")
        if g:
            j = i
            while j < len(adimlar) and adimlar[j].get("ayniAnda") == g:
                if adimlar[j].get("kesinti"):
                    raise SenaryoHatasi("ayniAnda grubunda kesinti yok")
                j += 1
            if j - i > 4 or j - i < 2:
                raise SenaryoHatasi("ayniAnda grubu 2–4 adım")
            if any(x.get("ayniAnda") == g for x in adimlar[j:]):
                raise SenaryoHatasi("ayniAnda grubu ardışık olmalı")
            i = j
        else:
            i += 1


# ───────────────────────────────────────────────── cari kâhini (para anlamı) — önbellekli
_CARI_ONBELLEK = {}


def cari_sonuclari(adimlar_sirali, cariler, bugun):
    """Cari kâhinini (2.4.6) çevrilmiş adımlarla kurar; cari başına bakiye, fatura açıkları (satış: alacak tarafı kuyruğu, alış: borç tarafı) ve
    açılış Kalan'ı. Cari kâhini bir adımı reddederse bu katmanın ön denetimi eksiktir → hata (öz denetim)."""
    anahtar = json.dumps([adimlar_sirali, cariler, bugun], sort_keys=True, ensure_ascii=False)
    if anahtar in _CARI_ONBELLEK:
        return _CARI_ONBELLEK[anahtar]
    m = CARI.Model({"dil": CARI.DIL, "ad": "mobil-yazma", "bugun": bugun, "adimlar": []}, 0, CARI_KURAL)
    for a in adimlar_sirali:
        m._onbellek = {}
        sonuc = getattr(m, a["islem"])(a)
        if isinstance(sonuc, tuple):
            raise SenaryoHatasi("cari kâhini adımı reddetti (katman ön denetimi eksik): %s" % json.dumps(a, ensure_ascii=False))
    m._onbellek = {}
    out = {}
    for cad, kartli in cariler:
        r = {"bakiye": m.bakiye(cad)}
        if not kartli:
            alacak = m.kuyruk(cad)
            borc = m.kuyruk_borc(cad)
            r["fatura"] = {k: v for k, v in list(alacak.items()) + list(borc.items()) if k in m.faturalar}
            r["acilis"] = alacak.get("acilis:" + cad)
        out[cad] = r
    _CARI_ONBELLEK[anahtar] = out
    return out


# ───────────────────────────────────────────────── model
class Kahin:
    def __init__(self, senaryo, param=None, mut=0):
        dogrula(senaryo)
        self.s = senaryo
        self.P = dict(ONERI)
        if param:
            for k, v in param.items():
                if k not in PARAMETRELER or v not in PARAMETRELER[k]:
                    raise SenaryoHatasi("parametre geçersiz: %s=%s" % (k, v))
                self.P[k] = v
        self.mut = mut
        self._grup_on = None

    # ─── başlangıç dünyası
    def _bos_sirket(self, ayar):
        ayar = ayar or {}
        return {"kasaEksi": ayar.get("kasaEksi", "kontrol_yok"), "benzerAcik": ayar.get("benzer", True), "kilit": None,
                "cariler": {}, "cariSira": [], "faturalar": {}, "kartlar": {}, "hesaplar": {}, "urunler": {}, "kayitlar": {},
                "kasa": {}, "para": {}, "portfoy": 0, "evrakSayisi": 0, "benzer": {}, "cariAdim": {}, "yedekler": {}}

    def _baslangic(self):
        b = self.s["baslangic"]
        w = {"simdi": zaman(b["simdi"]), "sunucu": True, "lisans": b.get("lisans", "gecerli") == "gecerli",
             "kullanicilar": {}, "cihazlar": {}, "sirketler": {}, "istekler": {}, "bekleyen": {}, "kuyruk": [], "out": {},
             "ciftTur": {}}
        for kod, ayar in (b.get("sirketler") or {"001": {}}).items():
            w["sirketler"][kod] = self._bos_sirket(ayar)
        kul = {"Y": {"rol": "yonetici", "uzak": True}}
        kul.update(b.get("kullanicilar") or {})
        for ad, u in kul.items():
            w["kullanicilar"][ad] = {"rol": u["rol"], "uzak": bool(u.get("uzak", False)),
                                     "sirketler": list(u.get("sirketler", [])), "eslemeSirketleri": None}
        for c, u in (b.get("cihazlar") or {}).items():
            self._esle(w, c, u)
        return w

    def _esle(self, w, cihaz, kullanici):
        if kullanici not in w["kullanicilar"]:
            raise SenaryoHatasi("cihaz_esle: kullanıcı yok %s" % kullanici)
        if cihaz in w["cihazlar"]:
            raise SenaryoHatasi("cihaz adı yeniden kullanılamaz: %s (yeni eşleme yeni cihazdır)" % cihaz)
        aktif = sum(1 for d in w["cihazlar"].values() if d["aktif"])
        if aktif >= 3:
            raise SenaryoHatasi("4. eşli cihaz (3 cihaz sınırı M2 kâhininin konusu; bu senaryo kurmaz)")
        if not w["kullanicilar"][kullanici]["uzak"]:
            raise SenaryoHatasi("Uzaktan Bağlanabilir olmayan kullanıcıya eşleme yapılamaz (M2)")
        w["cihazlar"][cihaz] = {"kullanici": kullanici, "aktif": True,
                                "sirketlerAn": list(w["kullanicilar"][kullanici]["sirketler"])}

    # ─── yetki
    def _sirket_gorur(self, w, kullanici, sirket, cihaz=None):
        """MEVCUT ÜRÜN (ana oturum koddan doğruladı): yönetici her şirketi görür; işaretli şirketler; hiç işaretsiz → yalnız 001."""
        u = w["kullanicilar"][kullanici]
        if u["rol"] == "yonetici":
            return True
        isaret = u["sirketler"]
        if self.mut == 42 and cihaz is not None:
            isaret = w["cihazlar"][cihaz]["sirketlerAn"]
        return sirket in isaret if isaret else sirket == "001"

    @staticmethod
    def _rol_yetkisi(rol, islem, yol, kart):
        """SENARYO-DILI §5.5 (PLAN §2.5, §9.1, §9.2): 200 / 403 / 'B' (plan söylemiyor — senaryo kurmaz)."""
        if islem == "tahsilat":
            if yol in ("cek", "senet"):
                return 200 if rol == "yonetici" else "B"
            return 200  # nakit, havale, POS, taksit tahsilatı herkese açık
        if islem == "odeme":
            if yol == "nakit":
                return 200 if rol == "yonetici" else "B"
            return 403 if rol == "personel" else 200
        if islem == "stok":
            return 200 if rol == "yonetici" else "B"
        raise SenaryoHatasi("rol yetkisi: islem %s" % islem)

    # ─── çıktı
    def _sonuc(self, w, adim_id, durum, http=None, kod=None, sunucu=None):
        o = w["out"]
        o["adim:%s:durum" % adim_id] = durum
        if http is not None:
            o["adim:%s:http" % adim_id] = http
        if kod is not None:
            o["adim:%s:kod" % adim_id] = kod
        if sunucu is not None:
            o["adim:%s:sunucu" % adim_id] = sunucu

    # ─── kurulum ve ortam adımları
    def _S(self, w, a):
        kod = a.get("sirket", "001")
        if kod not in w["sirketler"]:
            raise SenaryoHatasi("%s: şirket yok %s" % (a["id"], kod))
        return w["sirketler"][kod]

    def _cari_adim(self, S, cari, adim):
        S["cariAdim"].setdefault(cari, []).append(adim)

    def kurulum(self, w, a):
        i = a["islem"]
        if i == "sirket_ac":
            if a["sirket"] in w["sirketler"] or a["sirket"] != "002":
                raise SenaryoHatasi("sirket_ac yalnız 002 ve bir kez (en çok 2 şirket)")
            w["sirketler"]["002"] = self._bos_sirket(a)
            return
        S = self._S(w, a)
        bugun = gun(w["simdi"])
        if i == "ayar":
            if "kasaEksi" in a:
                S["kasaEksi"] = a["kasaEksi"]
            if "benzer" in a:
                S["benzerAcik"] = bool(a["benzer"])
        elif i == "cari_ac":
            tarih = a.get("tarih", bugun)
            acilis = kurus(a["acilis"]) if a.get("acilis") else 0
            if a.get("acilis") and acilis is None:
                raise SenaryoHatasi("cari_ac açılış tutarı")
            S["cariler"][a["ad"]] = {"isim": a["isim"], "tur": a.get("tur", "musteri"), "silindi": False, "acilis": acilis, "tarih": tarih}
            S["cariSira"].append(a["ad"])
            ca = {"id": a["id"], "islem": "cari_ac", "ad": a["ad"], "isim": a["isim"], "tur": a.get("tur", "musteri"), "tarih": tarih}
            if acilis:
                ca["acilis"] = tl(acilis)
            self._cari_adim(S, a["ad"], ca)
        elif i == "fatura":
            c = S["cariler"].get(a["cari"])
            if not c or c["silindi"]:
                raise SenaryoHatasi("fatura: cari yok")
            tur = a.get("tur", "satis")
            if tur not in ("satis", "alis"):
                raise SenaryoHatasi("fatura türü satis/alis")
            t = kurus(a["tutar"])
            S["faturalar"][a["ad"]] = {"cari": a["cari"], "tur": tur, "tutar": t, "tarih": a.get("tarih", bugun), "seq": len(S["faturalar"])}
            self._cari_adim(S, a["cari"], {"id": a["id"], "islem": "fatura", "ad": a["ad"], "cari": a["cari"], "tutar": tl(t),
                                           "tarih": a.get("tarih", bugun), "tur": tur})
        elif i == "iade":
            # masaüstü: satış faturasının tamamının iadesi (geri ödemesiz; cari kâhini `iade`) — mobil ödemenin KS8 iade geri ödemesi komşusu için
            F = S["faturalar"].get(a["fatura"])
            if not F or F["tur"] != "satis":
                raise SenaryoHatasi("iade: satış faturası yok")
            S["faturalar"][a["ad"]] = {"cari": F["cari"], "tur": "iade", "tutar": F["tutar"], "tarih": a.get("tarih", bugun), "seq": len(S["faturalar"])}
            self._cari_adim(S, F["cari"], {"id": a["id"], "islem": "iade", "ad": a["ad"], "fatura": a["fatura"], "tarih": a.get("tarih", bugun)})
        elif i == "kart_ac":
            c = S["cariler"].get(a["cari"])
            if not c or c["silindi"] or any(f["cari"] == a["cari"] for f in S["faturalar"].values()):
                raise SenaryoHatasi("kart_ac: cari yok ya da faturalı (taksit kartlı caride fatura açığı tanımsız — cari kâhini)")
            t, n = kurus(a["tutar"]), int(a.get("taksit", 1))
            pay = [t // n] * n
            pay[-1] += t - sum(pay)
            S["kartlar"][a["ad"]] = {"cari": a["cari"], "toplam": t, "taksitler": pay, "odemeler": {}}
            self._cari_adim(S, a["cari"], {"id": a["id"], "islem": "kart_ac", "ad": a["ad"], "cari": a["cari"], "tutar": tl(t),
                                           "taksit": n, "ilkVade": a.get("ilkVade", bugun), "tarih": a.get("tarih", bugun), "mevcut": True})
        elif i == "hesap_ac":
            if a.get("tur") not in ("banka", "pos", "kart"):
                raise SenaryoHatasi("hesap türü banka/pos/kart")
            S["hesaplar"][a["ad"]] = {"tur": a["tur"]}
            S["para"]["hesap|" + a["ad"]] = 0
        elif i == "urun_ac":
            S["urunler"][a["ad"]] = {"isim": a.get("isim", a["ad"]), "hareketler": {}}
            if a.get("miktar"):
                S["urunler"][a["ad"]]["hareketler"][a["id"]] = int(a["miktar"])
        elif i == "kasa_acilis":
            S["kasa"][a["id"]] = (a.get("tarih", bugun), kurus(a["tutar"]))
        elif i == "cari_sil":
            c = S["cariler"].get(a["cari"])
            if not c or any(k.get("cari") == a["cari"] for k in S["kayitlar"].values()) or c["acilis"] \
                    or any(f["cari"] == a["cari"] for f in S["faturalar"].values()):
                raise SenaryoHatasi("cari_sil yalnız hareketsiz cari (senaryo kurmaz)")
            c["silindi"] = True
        elif i == "donem_kilitle":
            S["kilit"] = a.get("tarih") or None
        elif i == "yedek_al":
            S["yedekler"][a["ad"]] = copy.deepcopy({k: v for k, v in S.items() if k != "yedekler"})
            S["yedekler"][a["ad"]]["__istekler"] = copy.deepcopy({k: v for k, v in w["istekler"].items() if v["sirket"] == a.get("sirket", "001")})
        elif i == "yedek_geri_yukle":
            y = copy.deepcopy(S["yedekler"][a["yedek"]])
            ist = y.pop("__istekler")
            yedekler = S["yedekler"]
            S.clear()
            S.update(y)
            S["yedekler"] = yedekler
            kod = a.get("sirket", "001")
            if self.mut != 32:
                # YAYGIN (V12): istek kimlikleri şirket verisiyle aynı anlık görüntüdedir (PLAN §1112/§1133: request_keys şirket veri dosyasında)
                for k in [k for k, v in w["istekler"].items() if v["sirket"] == kod]:
                    del w["istekler"][k]
                w["istekler"].update(ist)

    def ortam(self, w, a):
        i = a["islem"]
        if i == "saat":
            z = zaman(a["simdi"])
            if z < w["simdi"]:
                raise SenaryoHatasi("saat geri alınamaz")
            w["simdi"] = z
        elif i == "sunucu":
            d = a["durum"]
            if d == "kapali":
                w["sunucu"] = False
            elif d == "acik":
                w["sunucu"] = True
                if self.mut == 7:
                    kuyruk, w["kuyruk"] = w["kuyruk"], []
                    for (b, ctx) in kuyruk:
                        self.istek(w, b, dict(ctx, zaman=w["simdi"]), kayit_id=b["id"] + "-kuyruk", sessiz=True)
            elif d == "yeniden":
                w["sunucu"] = True  # PLAN §11 Aşama 2 "Yeniden başlatmadan sonra istek kimliği hatırlanır" — durum kalıcı
            else:
                raise SenaryoHatasi("sunucu durum kapali/acik/yeniden")
        elif i == "cihaz_esle":
            self._esle(w, a["cihaz"], a["kullanici"])
        elif i == "cihaz_sil":
            w["cihazlar"][a["cihaz"]]["aktif"] = False
        elif i == "uzak_izin":
            w["kullanicilar"][a["kullanici"]]["uzak"] = bool(a["deger"])
            if not a["deger"] and self.mut != 9:
                # PRO-UZAKTAN-GORUNTULEME "Yeniden eşleme gereken durumlar: … yönetici cihazı ya da izni kaldırır" → izin kaldırılınca cihazları düşer
                for d in w["cihazlar"].values():
                    if d["kullanici"] == a["kullanici"]:
                        d["aktif"] = False
        elif i == "sirket_yetki":
            w["kullanicilar"][a["kullanici"]]["sirketler"] = list(a.get("sirketler", []))
        elif i == "lisans":
            w["lisans"] = a["durum"] == "gecerli"
        elif i == "surum_yukselt":
            pass  # sürücü burada programı 2.4.7'ye yükseltir (kaynakSurum adımları eski sürümün gerçek koduyla girilir)

    # ─── istek (para / stok)
    def _ret(self, w, a, sessiz, http, kod=None, sunucu_gizli=False):
        if not sessiz:
            if sunucu_gizli:
                self._sonuc(w, a["id"], "belirsiz", sunucu="ret")
            else:
                self._sonuc(w, a["id"], "ret", http=http, kod=kod)
        return "ret"

    def istek(self, w, a, ctx, kayit_id=None, sessiz=False):
        """Tek isteği uygular. ctx: kanal, cihaz, kullanici, zaman (gönderim), form (formun açıldığı an), kesinti, yeniden (bool), budama (None/True/False).
        Ret önceliği SENARYO-DILI §5.6 (403 → 400 → istek kimliği → 404/409 hedef → Benzer İşlem → eksi); mobil kapılar (sunucu, kesinti, lisans, cihaz,
        uzak izni) programa ULAŞMADAN önce (kapıcı / telefon)."""
        mut = self.mut
        P = self.P
        kanal = ctx["kanal"]
        mobil = kanal == "mobil"
        rid = kayit_id or a["id"]
        simdi = ctx["zaman"]
        islem = a["islem"]
        # 0. sunucu kapalı: telefon yazamaz; kuyruk YOK [KULLANICI 26.10 "sunucu kapalıysa … sadece tahsilat giremeyecekti"]
        if not w["sunucu"]:
            if not mobil:
                raise SenaryoHatasi("%s: sunucu kapalıyken masaüstü işlemi kurulmaz" % a["id"])
            if mut == 7:
                w["kuyruk"].append((a, dict(ctx, kesinti=None)))
            if not sessiz:
                self._sonuc(w, a["id"], "ulasilamadi")
            return "ulasilamadi"
        # 1. kesinti "önce": istek sunucuya ulaşmadı
        if ctx.get("kesinti") == "once" and mut != 35:
            if not sessiz:
                self._sonuc(w, a["id"], "belirsiz", sunucu="yok")
            return "belirsiz"
        gizli = ctx.get("kesinti") in ("sonra",) or (ctx.get("kesinti") == "once" and mut == 35)
        kullanici = ctx.get("kullanici") or "Y"
        if mobil:
            # 2–4. kapıcı: lisans, eşli cihaz, Uzaktan Bağlanabilir [PRO-UZAKTAN-GORUNTULEME "Lisans süresi biter … Worker o ofisin dosyasını vermez";
            # iş listesi M2 "cihaz silme → erişim kesilir"; PRO "yönetici cihazı ya da izni kaldırır → yeniden eşleme"]
            if not w["lisans"] and mut != 10:
                return self._ret(w, a, sessiz, "4xx", sunucu_gizli=gizli)
            d = w["cihazlar"].get(ctx["cihaz"])
            if d is None:
                return self._ret(w, a, sessiz, "4xx", sunucu_gizli=gizli)
            if not d["aktif"] and mut != 8:
                return self._ret(w, a, sessiz, "4xx", sunucu_gizli=gizli)
            if mut == 41 and any(x["kullanici"] == d["kullanici"] and not x["aktif"] for x in w["cihazlar"].values()):
                return self._ret(w, a, sessiz, "4xx", sunucu_gizli=gizli)
            kullanici = d["kullanici"]
            if not w["kullanicilar"][kullanici]["uzak"] and mut != 9:
                return self._ret(w, a, sessiz, "4xx", sunucu_gizli=gizli)
        if kullanici not in w["kullanicilar"]:
            raise SenaryoHatasi("%s: kullanıcı yok %s" % (a["id"], kullanici))
        rol = w["kullanicilar"][kullanici]["rol"]
        sirket = a.get("sirket", "001")
        if mobil and mut == 39:
            sirket = "001"
        if sirket not in w["sirketler"]:
            raise SenaryoHatasi("%s: şirket yok" % a["id"])
        # 5. şirket yetkisi [MEVCUT ÜRÜN] — 403 (durum kodu kararda yok → 4xx)
        if not self._sirket_gorur(w, kullanici, sirket, ctx.get("cihaz") if mobil else None) and not (mobil and mut == 11):
            return self._ret(w, a, sessiz, "4xx", sunucu_gizli=gizli)
        S = w["sirketler"][sirket]
        yol = a.get("yol", "nakit") if islem != "stok" else None
        kart = a.get("kart")
        # 6. rol yetkisi [PLAN §5.5]
        if islem in ("tahsilat", "odeme"):
            y = self._rol_yetkisi(rol, islem, yol, kart)
        else:
            y = self._rol_yetkisi(rol, "stok", None, None)
        if y == "B":
            raise SenaryoHatasi("%s: rol %s için %s/%s planda yazılı değil (B — senaryo kurmaz; göreli çiftle denenir)" % (a["id"], rol, islem, yol))
        if y == 403 and not (mobil and mut == 28):
            return self._ret(w, a, sessiz, 403, sunucu_gizli=gizli)
        # 7. girdi (400)
        if islem == "stok":
            tutar = miktar_coz(a.get("miktar"))
            if a.get("yon") not in ("giris", "cikis"):
                raise SenaryoHatasi("%s: stok yonu giris/cikis" % a["id"])
        else:
            tutar = kurus(a.get("tutar"))
            if (islem == "tahsilat" and yol not in TAHSILAT_YOLLARI) or (islem == "odeme" and yol not in ODEME_YOLLARI):
                return self._ret(w, a, sessiz, 400, sunucu_gizli=gizli)
        if tutar is None:
            return self._ret(w, a, sessiz, 400, sunucu_gizli=gizli)
        fatura = a.get("fatura")
        # mobilin VERİ alanı kısıtları (S1, S2, S3, S8): telefon alanı göstermez; alanlı istek (eski form / el yapımı) beyaz listede reddedilir — sessizce
        # FIFO'ya / başka yola çevrilmez (V8: para verisi sessizce değişmez)
        if mobil:
            if fatura and P["kapatilacak"] == "yalniz_fifo" and mut != 17:
                return self._ret(w, a, sessiz, "4xx", sunucu_gizli=gizli)
            if yol in ("cek", "senet") and P["yollar"] == "nakit_havale_pos" and mut != 38:
                return self._ret(w, a, sessiz, "4xx", sunucu_gizli=gizli)
            if kart and P["taksit"] == "yalniz_cari" and mut != 47:
                return self._ret(w, a, sessiz, "4xx", sunucu_gizli=gizli)
            if islem == "stok" and a.get("yon") == "cikis" and P["stok_yonu"] == "yalniz_giris" and mut != 46:
                return self._ret(w, a, sessiz, "4xx", sunucu_gizli=gizli)
        if islem == "odeme" and kart:
            raise SenaryoHatasi("ödemede taksit kartı yok")
        if kart and yol in ("cek", "senet"):
            raise SenaryoHatasi("taksit kartına çek/senet bu dilde yok")
        if kart and fatura:
            raise SenaryoHatasi("taksit kartı + fatura birlikte yok")
        # onay bayrakları (S4, S5): "geçemez" = telefon bayrağı göndermez (uyarı varsa yazılmaz, yoksa iş yürür)
        yine = bool(a.get("yineDeKaydet"))
        benzer_onay = bool(a.get("benzerOnay"))
        fazla = bool(a.get("fazlaAvans"))
        eksi_onay = bool(a.get("eksiOnay"))
        if mobil and P["onay"] == "gecemez":
            yine = benzer_onay = fazla = False
        if mobil and P["eksi_stok"] == "gecemez" and mut != 22:
            eksi_onay = False
        # tarih (S6): masaüstü form tarihi gönderir; mobil "sunucu_gunu" tarih göndermez (sunucunun TR günü), "form_tarihi" formun tarihini gönderir
        gonderilen = None
        if not mobil or P["tarih"] == "form_tarihi" or (mobil and mut == 45):
            gonderilen = a.get("tarih") or gun(ctx["form"])
            tarih = gonderilen
        else:
            tarih = gun(simdi, utc=(mut == 24))
            if mut == 25 and ctx.get("yeniden"):
                tarih = gun(ctx["form"])
        if not tarih_gecerli(tarih):
            return self._ret(w, a, sessiz, 400, sunucu_gizli=gizli)
        if tarih > gun(simdi) and not (mobil and mut == 27):
            return self._ret(w, a, sessiz, 400, sunucu_gizli=gizli)   # PLAN §2.5 "İleri tarihli hareket girilmez"
        # hesap seçimi [PLAN §3.5] — havale → banka, POS → POS, kart (ödeme) → kurumsal kart
        hesap = None
        if islem != "stok" and yol in ("havale", "pos", "kart"):
            istenen = {"havale": "banka", "pos": "pos", "kart": "kart"}[yol]
            uygun = sorted(h for h, x in S["hesaplar"].items() if x["tur"] == istenen)
            if a.get("hesap"):
                if a["hesap"] not in S["hesaplar"]:
                    return self._ret(w, a, sessiz, [400, 404], sunucu_gizli=gizli)   # başka şirketin / olmayan hesap
                if S["hesaplar"][a["hesap"]]["tur"] != istenen:
                    return self._ret(w, a, sessiz, 400, kod="bank-account-invalid", sunucu_gizli=gizli)
                hesap = a["hesap"]
            elif mobil and mut == 43:
                hesap = None
            elif len(uygun) == 1:
                hesap = uygun[0]
            elif len(uygun) > 1:
                return self._ret(w, a, sessiz, 400, kod="bank-account-required", sunucu_gizli=gizli)
        # 8. istek kimliği [PLAN §3.10/1: kalıcı; anahtar kullanıcı|kapsam|kimlik; aynı kimlik + farklı içerik → 409; 30 günden eskiler budanır]
        kapsam = islem + (":kart" if kart else "")
        govde = {"islem": islem, "kapsam": kapsam, "cari": a.get("cari"), "tutar": a.get("tutar") if islem != "stok" else None,
                 "miktar": a.get("miktar") if islem == "stok" else None, "yol": yol, "hesap": a.get("hesap"), "fatura": fatura,
                 "kart": kart, "fazlaAvans": fazla, "urun": a.get("urun"), "yon": a.get("yon"), "tarih": gonderilen,
                 "sirket": a.get("sirket", "001")}
        anahtar = "|".join([sirket if mut != 5 else "*", kullanici if mut != 4 else "*", kapsam, str(a["istekKimligi"])])
        onceki = w["istekler"].get(anahtar)
        if onceki is not None:
            yas = simdi - onceki["zaman"]
            omur = timedelta(days=1) if mut == 33 else KIMLIK_OMRU
            if yas > omur:
                if mut == 33 and yas <= KIMLIK_OMRU:
                    onceki = None
                elif ctx.get("budama") is None:
                    raise _Catal()
                elif ctx["budama"]:
                    del w["istekler"][anahtar]
                    onceki = None
        if onceki is not None and not (mut == 1 and ctx.get("yeniden")):
            if onceki["govde"] == govde or mut == 2:
                if not sessiz:
                    if gizli:
                        self._sonuc(w, a["id"], "belirsiz", sunucu="yineleme")
                    else:
                        self._sonuc(w, a["id"], "yineleme")
                return "yineleme"
            if mut != 3:
                return self._ret(w, a, sessiz, 409, sunucu_gizli=gizli)
        # 9. hedef [PLAN §5.6 grup 4]
        if islem in ("tahsilat", "odeme"):
            cari = a.get("cari")
            c = S["cariler"].get(cari)
            if c is None or c["silindi"]:
                baska = [k for k, x in w["sirketler"].items() if k != sirket and cari in x["cariler"]]
                if baska and mut == 12:
                    sirket = baska[0]
                    S = w["sirketler"][sirket]
                    c = S["cariler"][cari]
                else:
                    return self._ret(w, a, sessiz, [403, 404] if baska else 404, sunucu_gizli=gizli)
            if fatura:
                F = S["faturalar"].get(fatura)
                if F is None or F["cari"] != cari:
                    return self._ret(w, a, sessiz, 404, sunucu_gizli=gizli)   # başka carinin / şirketin faturası [KULLANICI B2.4 + YAYGIN]
                if F["tur"] not in (("satis",) if islem == "tahsilat" else ("alis", "iade")):
                    # ters yön [KULLANICI B2.4, kalıcı karar "fatura kapama yöne göre"]; ödemede Kapatılacak Fatura = iade belgesi KABUL [KULLANICI K-d, cari KARARLAR §10]
                    return self._ret(w, a, sessiz, 409, sunucu_gizli=gizli)
            if kart:
                K = S["kartlar"].get(kart)
                if K is None or K["cari"] != cari:
                    return self._ret(w, a, sessiz, 404, sunucu_gizli=gizli)
        else:
            if a.get("urun") not in S["urunler"]:
                return self._ret(w, a, sessiz, 404, sunucu_gizli=gizli)
        if S["kilit"] and tarih <= S["kilit"] and not (mobil and mut == 26):
            return self._ret(w, a, sessiz, 409, kod="period-locked", sunucu_gizli=gizli)
        if kart:
            K = S["kartlar"][kart]
            odemeler = K["odemeler"]
            if mut == 31 and self._grup_on is not None and (sirket, kart) in self._grup_on:
                odemeler = self._grup_on[(sirket, kart)]   # kilitsiz yarış: kalan grubun başındaki durumdan okunur
            kalan = K["toplam"] - sum(odemeler.values())
            if kalan <= 0 and mut != 19:
                return self._ret(w, a, sessiz, 409, kod="plan-paid", sunucu_gizli=gizli)
            if tutar > kalan and mut != 18:
                if fazla:
                    if rol == "personel" and mut != 20:
                        return self._ret(w, a, sessiz, 403, kod="plan-overpay-permission", sunucu_gizli=gizli)
                    if rol == "muhasebe":
                        raise SenaryoHatasi("%s: muhasebenin plans.manage yetkisi planda yok (B)" % a["id"])
                else:
                    return self._ret(w, a, sessiz, 409, kod="plan-overpay", sunucu_gizli=gizli)
        # 10. Benzer İşlem [PLAN §3.10/2 — yalnız hesaba bağlı (fin_ref dolu) satır; aynı iş günü; hedefli]
        bkey = None
        if islem != "stok" and hesap is not None and yol in ("havale", "pos", "kart"):
            hedef = fatura or (("kart:" + kart) if kart else "")
            bkey = json.dumps([islem, yol, hesap, a.get("cari"), tutar, tarih, hedef])
            if S["benzerAcik"] and bkey in S["benzer"].values() and not benzer_onay and not (mobil and mut == 40):
                return self._ret(w, a, sessiz, 409, kod="bank-similar", sunucu_gizli=gizli)
        # 11. eksi bakiye (Kasa, nakit ödeme) [PLAN §3.9 / SENARYO-DILI §5.3] ve eksi stok [kalıcı karar 02.10.2026 "program sorar"]
        if islem == "odeme" and yol == "nakit" and not (mobil and mut == 23):
            satir = list(S["kasa"].values()) + [(tarih, -tutar)]
            b_d = sum(x for t, x in satir if t <= tarih)
            b_t = sum(x for _, x in satir)
            if min(b_d, b_t) < 0:
                if S["kasaEksi"] == "engelle":
                    return self._ret(w, a, sessiz, 409, kod="cash-blocked", sunucu_gizli=gizli)
                if S["kasaEksi"] == "uyar" and not yine:
                    return self._ret(w, a, sessiz, 409, kod="cash-negative", sunucu_gizli=gizli)
        if islem == "stok":
            mevcut = sum(S["urunler"][a["urun"]]["hareketler"].values())
            cikis = a["yon"] == "cikis" and not (mobil and mut == 30)
            if cikis and mevcut - tutar < 0 and not eksi_onay and not (mobil and mut == 21):
                return self._ret(w, a, sessiz, "4xx", sunucu_gizli=gizli)
        # ─── yazım
        kayit = {"id": rid, "islem": islem, "kanal": kanal, "kullanici": kullanici, "tarih": tarih, "zaman": simdi.isoformat()}
        if islem == "stok":
            isaret = -1 if (a["yon"] == "cikis" and not (mobil and mut == 30)) else 1
            S["urunler"][a["urun"]]["hareketler"][rid] = isaret * tutar
            if mobil and mut == 29 and isaret > 0:
                S["urunler"][a["urun"]]["hareketler"][rid + "-cift"] = tutar
            kayit.update(urun=a["urun"], miktar=isaret * tutar)
        else:
            cari = a["cari"]
            kayit.update(cari=cari, tutar=tutar, yol=yol, hesap=hesap, fatura=fatura, kart=kart)
            yon = 1 if islem == "tahsilat" else -1
            if yol == "nakit" or (yol == "pos" and mut == 13) or (yol == "havale" and mut == 14) or (yol in ("cek", "senet") and mut == 37):
                S["kasa"][rid] = (tarih, yon * tutar)
            elif yol in ("cek", "senet"):
                S["portfoy"] += tutar
                S["evrakSayisi"] += 1
            elif hesap is not None:
                S["para"]["hesap|" + hesap] = S["para"].get("hesap|" + hesap, 0) + yon * tutar
            else:
                h = "102.00" if yol == "havale" else "108.00"
                S["para"]["hesapsiz|" + h] = S["para"].get("hesapsiz|" + h, 0) + yon * tutar
            # cari kâhinine çeviri (eşdeğerlik: kanal fark etmez)
            f_cari = fatura
            if mobil and mut == 16 and fatura:
                f_cari = None
            if mobil and mut == 15 and not fatura and islem == "tahsilat" and not kart and yol not in ("cek", "senet"):
                adaylar = sorted((f["tarih"], f["seq"], ad) for ad, f in S["faturalar"].items() if f["cari"] == cari and f["tur"] == "satis")
                f_cari = adaylar[-1][2] if adaylar else None
            ca = {"id": rid, "tutar": tl(tutar), "tarih": tarih}
            if kart:
                S["kartlar"][kart]["odemeler"][rid] = tutar
                ca.update(islem="kart_tahsilat", kayit=kart)
            elif yol in ("cek", "senet"):
                ca.update(islem="evrak", ad="E_" + rid.upper().replace("-", "_"), cari=cari, tur=yol)
                if f_cari:
                    ca["fatura"] = f_cari
            elif islem == "tahsilat" or (mobil and mut == 36):
                ca.update(islem="tahsilat", cari=cari, yol="nakit" if yol == "nakit" else "havale")
                if f_cari:
                    ca["fatura"] = f_cari
            else:
                ca.update(islem="odeme", cari=cari)
                if f_cari:
                    ca["fatura"] = f_cari
            self._cari_adim(S, cari, ca)
            if bkey is not None:
                S["benzer"][rid] = bkey
        S["kayitlar"][rid] = kayit
        w["istekler"][anahtar] = {"govde": govde, "zaman": simdi, "kayit": rid, "sirket": sirket}
        if mut == 48 and gizli:
            self._geri_al(w, S, rid, anahtar)
        if not sessiz:
            if gizli:
                self._sonuc(w, a["id"], "belirsiz", sunucu="ok")
            else:
                self._sonuc(w, a["id"], "ok")
        return "ok"

    def _geri_al(self, w, S, rid, anahtar):
        S["kayitlar"].pop(rid, None)
        S["kasa"].pop(rid, None)
        S["benzer"].pop(rid, None)
        for u in S["urunler"].values():
            u["hareketler"].pop(rid, None)
        for K in S["kartlar"].values():
            K["odemeler"].pop(rid, None)
        for lst in S["cariAdim"].values():
            lst[:] = [x for x in lst if x["id"] != rid]
        w["istekler"].pop(anahtar, None)

    def _red_kimligi(self, w, a, ctx):
        """Mutasyon 6: reddedilen isteğin kimliği de hatırlanır (yalnız istek sunucuya ulaştıysa)."""
        kapsam = a["islem"] + (":kart" if a.get("kart") else "")
        kullanici = ctx.get("kullanici") or "Y"
        if ctx["kanal"] == "mobil" and ctx.get("cihaz") in w["cihazlar"]:
            kullanici = w["cihazlar"][ctx["cihaz"]]["kullanici"]
        anahtar = "|".join([a.get("sirket", "001"), kullanici, kapsam, str(a["istekKimligi"])])
        w["istekler"].setdefault(anahtar, {"govde": None, "zaman": ctx["zaman"], "kayit": None, "sirket": a.get("sirket", "001")})

    def para_adimi(self, w, a, budama=None):
        form = zaman(a["formAcilis"]) if a.get("formAcilis") else w["simdi"]
        if form > w["simdi"]:
            raise SenaryoHatasi("%s: formAcilis gönderimden sonra olamaz" % a["id"])
        ctx = {"kanal": a["kanal"], "cihaz": a.get("cihaz"), "kullanici": a.get("kullanici"), "zaman": w["simdi"], "form": form,
               "kesinti": a.get("kesinti"), "yeniden": False, "budama": budama}
        w["bekleyen"][a["id"]] = {"adim": a, "ctx": dict(ctx, budama=None)}
        r = self.istek(w, a, ctx)
        if r == "ret" and self.mut == 6:
            self._red_kimligi(w, a, ctx)
        return r

    def yeniden(self, w, a, budama=None):
        """Aynı isteğin (aynı kimlik, aynı gövde, aynı cihaz/kullanıcı) yeniden gönderimi; tarih kuralı S6, geç gönderim S7."""
        b = w["bekleyen"][a["adim"]]
        orj, octx = b["adim"], b["ctx"]
        if octx["kanal"] == "mobil" and self.P["gec_yeniden"] == "telefon_24s" and self.mut != 34 \
                and w["simdi"] - octx["form"] > TELEFON_OMRU:
            self._sonuc(w, a["id"], "atildi")
            return "atildi"
        ctx = dict(octx, zaman=w["simdi"], kesinti=a.get("kesinti"), yeniden=True, budama=budama)
        sanal = dict(orj, id=a["id"])
        r = self.istek(w, sanal, ctx)
        w["bekleyen"][a["id"]] = {"adim": orj, "ctx": octx}   # yeniden gönderimin yeniden gönderimi aynı ilk isteği anar
        return r

    # ─── kontrol
    def kontrol(self, w, a):
        k = a["id"]
        o = w["out"]
        bugun = gun(w["simdi"])
        for kod in sorted(w["sirketler"]):
            S = w["sirketler"][kod]
            p = "%s:%s:" % (k, kod)
            kartli = {K["cari"] for K in S["kartlar"].values()}
            sirali = []
            for cad in S["cariSira"]:
                sirali.extend(S["cariAdim"].get(cad, []))
            cariler = [(cad, cad in kartli) for cad in S["cariSira"]]
            cs = cari_sonuclari(sirali, cariler, bugun)
            for cad in S["cariSira"]:
                c = S["cariler"][cad]
                if c["silindi"]:
                    continue
                r = cs[cad]
                o[p + "cari:%s:bakiye" % cad] = r["bakiye"]
                o[p + "cari:%s:hareketSayisi" % cad] = sum(1 for x in S["kayitlar"].values() if x.get("cari") == cad and not x.get("kart")
                                                             and x.get("yol") not in ("cek", "senet"))
                if cad not in kartli:
                    for fad, v in sorted(r["fatura"].items()):
                        o[p + "fatura:%s:acik" % fad] = v
                    if c["acilis"]:
                        o[p + "acilis:%s:kalan" % cad] = r["acilis"]
            for kad in sorted(S["kartlar"]):
                K = S["kartlar"][kad]
                odenen_ham = sum(K["odemeler"].values())
                odenen = min(odenen_ham, K["toplam"])
                o[p + "kart:%s:odenen" % kad] = odenen
                o[p + "kart:%s:fazla" % kad] = odenen_ham - odenen
                o[p + "kart:%s:kalan" % kad] = K["toplam"] - odenen
                o[p + "kart:%s:tahsilatSayisi" % kad] = len(K["odemeler"])
                kalan = odenen
                sira = list(range(len(K["taksitler"])))
                if self.mut == 44:
                    sira.reverse()
                pay = [0] * len(sira)
                for i in sira:
                    pay[i] = min(K["taksitler"][i], kalan)
                    kalan -= pay[i]
                for i, v in enumerate(pay):
                    o[p + "kart:%s:taksit%d:odenen" % (kad, i + 1)] = v
            kasa_satir = list(S["kasa"].values())
            o[p + "kasa"] = sum(x for _, x in kasa_satir)
            gunler = {}
            for t, x in kasa_satir:
                gunler[t] = gunler.get(t, 0) + x
            for t in sorted(gunler):
                if gunler[t]:
                    o[p + "kasaGun:%s" % t] = gunler[t]
            for h in sorted(S["hesaplar"]):
                tur = S["hesaplar"][h]["tur"]
                ad = {"banka": "banka", "pos": "pos", "kart": "kartHesap"}[tur]
                o[p + "%s:%s" % (ad, h)] = S["para"].get("hesap|" + h, 0)
            for th, v in sorted(S["para"].items()):
                t, _, h = th.partition("|")
                if t == "hesapsiz" and v:
                    o[p + "hesapsiz:%s" % h] = v
            o[p + "portfoy"] = S["portfoy"]
            o[p + "evrakSayisi"] = S["evrakSayisi"]
            for u in sorted(S["urunler"]):
                h = S["urunler"][u]["hareketler"]
                o[p + "stok:%s:miktar" % u] = sum(h.values())
                o[p + "stok:%s:hareketSayisi" % u] = len(h)

    # ─── koşu (dünyalar: ayniAnda sıralamaları ve budama çatalı)
    def _adim(self, w, a):
        i = a["islem"]
        if i in KURULUM:
            self.kurulum(w, a)
            return [w]
        if i in ORTAM:
            self.ortam(w, a)
            return [w]
        if i == "kontrol":
            self.kontrol(w, a)
            return [w]
        fn = self.yeniden if i == "yeniden_gonder" else self.para_adimi
        try:
            fn(w, a)
            return [w]
        except _Catal:
            # _Catal yazımdan ÖNCE (istek kimliği aşamasında) atılır; dünya değişmemiştir → iki kopya
            dunyalar = []
            for budama in (False, True):
                w2 = copy.deepcopy(w)
                fn(w2, a, budama=budama)
                dunyalar.append(w2)
            return dunyalar

    @staticmethod
    def _iz(w):
        return json.dumps({k: v for k, v in w.items() if k not in ("bekleyen",)}, sort_keys=True, default=str, ensure_ascii=False)

    def _birlestir(self, dunyalar):
        gorulen, out = set(), []
        for w in dunyalar:
            iz = self._iz(w)
            if iz not in gorulen:
                gorulen.add(iz)
                out.append(w)
        if len(out) > 64:
            raise SenaryoHatasi("dünya sayısı 64'ü aştı (ayniAnda grupları birbirine bağlı)")
        return out

    def kos_dunyalar(self):
        adimlar = self.s["adimlar"]
        dunyalar = [self._baslangic()]
        self._grup_on = None
        i = 0
        while i < len(adimlar):
            g = adimlar[i].get("ayniAnda")
            if g:
                j = i
                while j < len(adimlar) and adimlar[j].get("ayniAnda") == g:
                    j += 1
                grup = adimlar[i:j]
                yeni = []
                for w in dunyalar:
                    on = {(kod, kad): dict(K["odemeler"]) for kod, S in w["sirketler"].items() for kad, K in S["kartlar"].items()}
                    for sira in itertools.permutations(grup):
                        w2 = copy.deepcopy(w)
                        self._grup_on = on if self.mut == 31 else None
                        for x in sira:
                            r = self._adim(w2, x)
                            if len(r) != 1:
                                raise SenaryoHatasi("ayniAnda grubunda budama çatalı kurulmaz")
                            w2 = r[0]
                        self._grup_on = None
                        yeni.append(w2)
                dunyalar = self._birlestir(yeni)
                i = j
                continue
            yeni = []
            for w in dunyalar:
                yeni.extend(self._adim(w, adimlar[i]))
            dunyalar = self._birlestir(yeni) if len(yeni) > 1 else yeni
            i += 1
        return dunyalar

    def kos(self):
        return ozet([w["out"] for w in self.kos_dunyalar()])


def ozet(ciktilar):
    """Dünyaların çıktısı → ortak beklenen + alternatifler (her alternatif değişen anahtarların tutarlı bir ataması)."""
    tekil = []
    gorulen = set()
    for c in ciktilar:
        j = json.dumps(c, sort_keys=True, ensure_ascii=False)
        if j not in gorulen:
            gorulen.add(j)
            tekil.append(c)
    tekil.sort(key=lambda c: json.dumps(c, sort_keys=True, ensure_ascii=False))
    anahtarlar = sorted(set().union(*[set(c) for c in tekil])) if tekil else []
    ortak = {}
    degisen = []
    for k in anahtarlar:
        degerler = [json.dumps(c.get(k, "__yok__"), sort_keys=True) for c in tekil]
        if len(set(degerler)) == 1 and k in tekil[0]:
            ortak[k] = tekil[0][k]
        else:
            degisen.append(k)
    alternatifler = [] if len(tekil) == 1 else [{k: c.get(k, "__yok__") for k in degisen} for c in tekil]
    return {"beklenen": ortak, "alternatifler": alternatifler}


# ───────────────────────────────────────────────── karşılaştırma (program ↔ kabul)
def deger_uyar(beklenen, program):
    """'4xx' → 400–499; liste → üyelik; diğer → eşitlik."""
    if beklenen == "4xx":
        return isinstance(program, int) and 400 <= program <= 499
    if isinstance(beklenen, list):
        return any(deger_uyar(b, program) for b in beklenen)
    return beklenen == program


def karsilastir_tek(bek, program):
    """bek: {"beklenen", "alternatifler"}; program: {anahtar: değer}. Dönüş: fark satırları (boş = aynı). Eksik anahtar FARKTIR (ders 4)."""
    farklar = []
    for k, v in sorted(bek["beklenen"].items()):
        if k not in program:
            farklar.append("%s: program okunamadı/eksik (beklenen %s)" % (k, json.dumps(v, ensure_ascii=False)))
        elif not deger_uyar(v, program[k]):
            farklar.append("%s: program %s · beklenen %s" % (k, json.dumps(program[k], ensure_ascii=False), json.dumps(v, ensure_ascii=False)))
    if bek["alternatifler"]:
        tutan = [alt for alt in bek["alternatifler"]
                 if all((program.get(k, "__yok__") == "__yok__") if v == "__yok__" else (k in program and deger_uyar(v, program[k])) for k, v in alt.items())]
        if not tutan:
            farklar.append("hiçbir alternatife uymuyor (eşzamanlı sıralamalar / budama çatalı): %d alternatif" % len(bek["alternatifler"]))
    return farklar


def beklenen_bul(kayit, p):
    """kabul.json senaryo kaydından birleşim p'nin beklenenini bulur."""
    for g in kayit["gruplar"]:
        if all(p[k] == v for k, v in g["secim"].items()):
            return g
    for g in kayit.get("fark_gruplar", []):
        if all(p[k] == v for k, v in g["secim"].items()):
            taban = dict(kayit["gruplar"][0]["beklenen"])
            for k, v in g["fark"].items():
                if v == "__yok__":
                    taban.pop(k, None)
                else:
                    taban[k] = v
            return {"secim": g["secim"], "beklenen": taban, "alternatifler": g.get("alternatifler", [])}
    raise KeyError("birleşim kabul kaydında yok: %s (rastgele senaryolar yalnız 10 birleşim taşır — senaryolar.py --birlesim ile yeniden üretin)" % birlesim_adi(p))


def _cli(argv):
    if "--mutasyonlar" in argv:
        sys.stdout.write(json.dumps(MUTASYONLAR, ensure_ascii=False, indent=2) + "\n")
        return 0
    if len(argv) < 3:
        sys.stderr.write(__doc__)
        return 2
    komut = argv[1]
    if komut == "hesapla":
        with open(argv[2], encoding="utf-8") as f:
            s = json.load(f)
        p = dict(ONERI)
        for i, x in enumerate(argv):
            if x == "--param":
                k, _, v = argv[i + 1].partition("=")
                p[k] = v
        mut = int(argv[argv.index("--mutasyon") + 1]) if "--mutasyon" in argv else 0
        sys.stdout.write(json.dumps(Kahin(s, p, mut).kos(), ensure_ascii=False, indent=2, sort_keys=True) + "\n")
        return 0
    if komut == "karsilastir":
        with open(argv[2], encoding="utf-8") as f:
            kabul = json.load(f)
        with open(argv[3], encoding="utf-8") as f:
            program = json.load(f)
        p = birlesim_coz(argv[argv.index("--birlesim") + 1]) if "--birlesim" in argv else dict(ONERI)
        gecen = kalan = 0
        n = 0
        for s in kabul["senaryolar"]:
            n += 1
            if s["ad"] not in program:
                kalan += 1
                print("not ok %d - %s" % (n, s["ad"]))
                print("  # program çıktısı yok (okunamayan veri boş değildir — ders 4)")
                continue
            try:
                g = beklenen_bul(s, p)
            except KeyError as e:
                kalan += 1
                print("not ok %d - %s\n  # %s" % (n, s["ad"], e))
                continue
            farklar = karsilastir_tek(g, program[s["ad"]])
            if farklar:
                kalan += 1
                print("not ok %d - %s" % (n, s["ad"]))
                for x in farklar[:20]:
                    print("  # " + x)
            else:
                gecen += 1
                print("ok %d - %s" % (n, s["ad"]))
        print("1..%d" % n)
        for ad, v in (("tests", n), ("pass", gecen), ("fail", kalan), ("cancelled", 0), ("skipped", 0), ("todo", 0)):
            print("# %s %d" % (ad, v))
        return 0 if kalan == 0 and gecen > 0 else 1
    sys.stderr.write(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(_cli(sys.argv))
