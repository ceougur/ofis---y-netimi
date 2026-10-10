#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Model A birim testleri (unittest, yalnız standart kütüphane).

Koşturma:  python3 -I -m unittest discover -s test/bagimsiz/model_a -p 'test_*.py' -v
       ya da python3 -I test/bagimsiz/model_a/test_model.py -v

Beklenen sayılar elle, plandan (docs/BANKA-MODULU-PLAN.md §3.7, §12.5) ve SENARYO-DILI.md'nin
kurallarından hesaplandı; kâhinin kendi çıktısından kopyalanmadı. Her testin yorumunda dayanak yazılı.
"""

import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import unittest

BURASI = os.path.dirname(os.path.abspath(__file__))
DEPO = os.path.abspath(os.path.join(BURASI, "..", "..", ".."))
SENARYOLAR = os.path.join(DEPO, "test", "bagimsiz", "senaryolar")
MODEL_YOLU = os.path.join(BURASI, "model.py")

_spec = importlib.util.spec_from_file_location("kahin_model_a", MODEL_YOLU)
model = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(model)


# ------------------------------------------------------------------ yardımcılar

def sen(ad, adimlar, bugun="08.10.2026", ayarlar=None, kullanicilar=None):
    b = {"bugun": bugun, "sirket": "bos"}
    if ayarlar:
        b["ayarlar"] = ayarlar
    if kullanicilar:
        b["kullanicilar"] = kullanicilar
    return {"dil": "destekofis-senaryo/1", "ad": ad, "baslangic": b, "adimlar": adimlar}


def hesap(aid, ad, tutar, tarih="01.10.2026", dog=True, tur="vadesiz", **kw):
    a = {"id": aid, "islem": "hesap_ac", "ad": ad, "banka": "Banka " + ad, "hesapAdi": "Ana TL Hesabı",
         "tur": tur, "paraBirimi": "TRY", "acilisTarihi": tarih, "acilisBakiyesi": tutar,
         "bakiyeDogrulandi": dog}
    a.update(kw)
    return a


def cari(aid, ad, tur="musteri"):
    return {"id": aid, "islem": "cari_ac", "ad": ad, "unvan": ad + " Ltd.", "tur": tur}


def hizmet_satis(aid, ad, c, fiyat, kdv=20, dahil=True, **kw):
    a = {"id": aid, "islem": "fatura", "ad": ad, "tur": "satis", "cari": c,
         "kalemler": [{"hizmet": "Danışmanlık", "miktar": 1, "birimFiyat": fiyat, "kdvOrani": kdv,
                       "kdvDahil": dahil}]}
    a.update(kw)
    return a


def kos(s):
    """Kâhini doğrudan çağırır; senaryo dosyası adı `ad` ile aynı olmak zorunda (§13/1)."""
    with tempfile.TemporaryDirectory() as d:
        yol = os.path.join(d, s["ad"] + ".json")
        with open(yol, "w", encoding="utf-8") as fh:
            json.dump(s, fh, ensure_ascii=False)
        return model.kahin(s, yol)


def kos_cli(s, *bayrak):
    with tempfile.TemporaryDirectory() as d:
        yol = os.path.join(d, s["ad"] + ".json")
        with open(yol, "w", encoding="utf-8") as fh:
            json.dump(s, fh, ensure_ascii=False)
        p = subprocess.run([sys.executable, "-I", MODEL_YOLU, yol] + list(bayrak),
                           capture_output=True, text=True)
        return p.returncode, p.stdout, p.stderr


def ret(o, adim):
    for r in o["retler"]:
        if r["adim"] == adim:
            return r
    return None


def mizan_dengede(test, miz):
    test.assertEqual(sum(v["borc"] for v in miz.values()), sum(v["alacak"] for v in miz.values()))
    for v in miz.values():
        test.assertFalse(v["borc"] and v["alacak"])


# ------------------------------------------------------------------ kabul 1–16

class KabulTesti(unittest.TestCase):
    """PLAN §12.5 adım 1–16 ve senaryolar/kabul-1-16.beklenen.json (elle, plandan)."""

    def setUp(self):
        with open(os.path.join(SENARYOLAR, "kabul-1-16.json"), encoding="utf-8") as fh:
            self.s = json.load(fh)
        with open(os.path.join(SENARYOLAR, "kabul-1-16.beklenen.json"), encoding="utf-8") as fh:
            self.b = json.load(fh)
        self.o = model.kahin(self.s, os.path.join(SENARYOLAR, "kabul-1-16.json"))

    def test_plan_sayilari(self):
        """Planın kontrol adımlarındaki 28 sayının hepsi (§9/1: kâhin ↔ plan)."""
        sayac, farklar = model.plan_denetimi(self.s, self.o)
        self.assertEqual(farklar, [])
        self.assertEqual(sayac, 28)

    def test_beklenen_dosyanin_tamami(self):
        o = dict(self.o)
        b = dict(self.b)
        for x in (o, b):
            x.pop("kaynak", None)
            x.pop("notlar", None)
        self.assertEqual(o, b)

    def test_son_mizan(self):
        """Plan adım 15–16 sonu: Ziraat 90.000, Garanti 70.000, Kasa 10.000, Kasa + Banka 170.000."""
        m = self.o["mizan"]
        self.assertEqual(m["102.01"], {"borc": 9000000, "alacak": 0})
        self.assertEqual(m["102.02"], {"borc": 7000000, "alacak": 0})
        self.assertEqual(m["100"], {"borc": 1000000, "alacak": 0})
        self.assertEqual(m["500"], {"borc": 0, "alacak": 15000000})
        self.assertEqual(m["600"], {"borc": 0, "alacak": 1666667})
        self.assertEqual(m["391"], {"borc": 0, "alacak": 333333})
        self.assertEqual(self.o["ozet"]["kasaVeGercekBanka"], 17000000)
        mizan_dengede(self, m)

    def test_cli_ve_belirlenimcilik(self):
        """Aynı senaryo iki koşuda bayt bayt aynı çıktı (§0 sözleşmesi); --plan-denetimi çıkış 0."""
        yol = os.path.join(SENARYOLAR, "kabul-1-16.json")
        p1 = subprocess.run([sys.executable, "-I", MODEL_YOLU, yol, "--plan-denetimi"], capture_output=True)
        p2 = subprocess.run([sys.executable, "-I", MODEL_YOLU, yol], capture_output=True)
        self.assertEqual(p1.returncode, 0, p1.stderr)
        self.assertEqual(p1.stdout, p2.stdout)
        self.assertIn("28 yaprak, hepsi tuttu", p1.stderr.decode("utf-8"))
        o = json.loads(p1.stdout)
        self.assertEqual(o["kaynak"], "kahin")


# ------------------------------------------------------------------ banka fişleri (PLAN §3.7)

class BankaFisleri(unittest.TestCase):

    def test_ornek_masraf_ve_cift_ters_kayit(self):
        """SENARYO-DILI §14: BSMV dahil 10,50 → 770 10,00 + 0,50; ters kayıt net 0; ikinci ters 409."""
        s = sen("ornek-masraf", [
            hesap("1", "ZIR", "1000", tarih="01.10.2026"),
            {"id": "2", "islem": "banka_masraf", "ad": "M1", "hesap": "ZIR", "tutar": "10,50",
             "masrafTuru": "EFT", "vergi": "bsmv_dahil"},
            {"id": "k2", "islem": "kontrol"},
            {"id": "3", "islem": "ters_kayit", "hedef": "M1"},
            {"id": "4", "islem": "ters_kayit", "hedef": "M1"},
        ], bugun="09.10.2026")
        o = kos(s)
        self.assertEqual(o["araDurumlar"]["k2"]["mizan"]["770"], {"borc": 1050, "alacak": 0})
        self.assertEqual(o["araDurumlar"]["k2"]["bankaHesaplari"]["ZIR"], 98950)
        self.assertEqual(o["retler"], [{"adim": "4", "durum": 409, "kod": None, "kodDayanak": None}])
        self.assertEqual(o["mizan"]["102.01"], {"borc": 100000, "alacak": 0})
        self.assertEqual(o["mizan"]["500"], {"borc": 0, "alacak": 100000})
        self.assertEqual(o["mizan"]["770"], {"borc": 0, "alacak": 0})
        self.assertEqual(o["bankaHesaplari"]["ZIR"], 100000)

    def test_bsmv_haric(self):
        """PLAN §3.7 #12: "BSMV Hariç girilen 10,00'dan 10,50 çıkar"."""
        s = sen("bsmv-haric", [
            hesap("1", "ZIR", "1000"),
            {"id": "2", "islem": "banka_masraf", "hesap": "ZIR", "tutar": "10", "masrafTuru": "Havale",
             "vergi": "bsmv_haric"},
            {"id": "3", "islem": "banka_masraf", "hesap": "ZIR", "tutar": "3", "masrafTuru": "Diğer",
             "vergi": "yok"},
        ])
        o = kos(s)
        self.assertEqual(o["bankaHesaplari"]["ZIR"], 100000 - 1050 - 300)
        self.assertEqual(o["mizan"]["770"], {"borc": 1350, "alacak": 0})

    def test_kdv_dahil_masraf(self):
        """PLAN §3.7 #13: KDV Dahil 120 → 770 100, 191 20, A 320 120; B 320 / A 102.01 120 → banka −120, cari 0."""
        s = sen("kdv-masraf", [
            hesap("1", "ZIR", "1000"),
            cari("2", "BNK", "tedarikci"),
            {"id": "3", "islem": "banka_masraf", "ad": "M1", "hesap": "ZIR", "tutar": "120", "masrafTuru": "EFT",
             "vergi": "kdv_dahil", "saglayici": "BNK", "fatura": "MF"},
            {"id": "4", "islem": "banka_masraf", "hesap": "ZIR", "tutar": "50", "masrafTuru": "EFT",
             "vergi": "kdv_haric", "saglayici": "BNK", "fatura": "MF2", "kdvOrani": 10},
        ])
        o = kos(s)
        # 50 KDV hariç %10: matrah 50, KDV 5, toplam 55
        self.assertEqual(o["bankaHesaplari"]["ZIR"], 100000 - 12000 - 5500)
        self.assertEqual(o["mizan"]["770"], {"borc": 10000 + 5000, "alacak": 0})
        self.assertEqual(o["mizan"]["191"], {"borc": 2000 + 500, "alacak": 0})
        self.assertEqual(o["mizan"]["320"], {"borc": 0, "alacak": 0})
        self.assertEqual(o["cariler"]["BNK"], 0)
        self.assertEqual(o["faturalar"]["MF"], {"toplam": 12000, "matrah": 10000, "kdv": 2000, "acik": 0})
        self.assertEqual(o["faturalar"]["MF2"], {"toplam": 5500, "matrah": 5000, "kdv": 500, "acik": 0})

    def test_faiz_stopaj(self):
        """PLAN §3.7 #14: Brüt 1.000, stopaj %15 → B 102 850 · B 193 150 / A 642 1.000."""
        s = sen("faiz", [
            hesap("1", "VDL", "0", tur="vadeli"),
            {"id": "2", "islem": "faiz_geliri", "hesap": "VDL", "brut": "1000", "stopajOrani": "15"},
        ])
        o = kos(s)
        self.assertEqual(o["mizan"]["102.01"], {"borc": 85000, "alacak": 0})
        self.assertEqual(o["mizan"]["193"], {"borc": 15000, "alacak": 0})
        self.assertEqual(o["mizan"]["642"], {"borc": 0, "alacak": 100000})
        self.assertEqual(o["ozet"]["gercekBanka"], 85000)   # vadeli de 102 alt hesabıdır (PLAN §8.4)

    def test_faiz_kart_kredi_diger(self):
        """PLAN §3.7 #3, #15–#18 ve §8.4 'Kart ve Kredi Borcu'. Sayılar elle (test yorumundaki zincir)."""
        s = sen("kart-kredi", [
            hesap("1", "ZIR", "100000"),
            hesap("2", "KK", "0", tur="kurumsal_kart", kartLimiti="10000"),
            hesap("3", "KR", "0", tur="kredi", dog=False),
            cari("4", "XYZ", "tedarikci"),
            {"id": "5", "islem": "faiz_gideri", "hesap": "ZIR", "tutar": "100"},
            {"id": "6", "islem": "diger_gelir", "hesap": "ZIR", "tutar": "50"},
            {"id": "7", "islem": "diger_gider", "hesap": "ZIR", "tutar": "20"},
            {"id": "8", "islem": "cari_odeme", "cari": "XYZ", "tutar": "3000", "yol": "kart"},
            {"id": "9", "islem": "kart_borcu_odeme", "kaynak": "ZIR", "kart": "KK", "tutar": "1000"},
            {"id": "10", "islem": "kredi_kullanim", "kredi": "KR", "hedef": "ZIR", "tutar": "50000"},
            {"id": "11", "islem": "kredi_odeme", "kredi": "KR", "kaynak": "ZIR", "anapara": "10000", "faiz": "500"},
        ])
        o = kos(s)
        # ZIR = 10.000.000 − 10.000 + 5.000 − 2.000 − 100.000 + 5.000.000 − 1.050.000 = 13.843.000 kuruş
        self.assertEqual(o["bankaHesaplari"], {"ZIR": 13843000, "KK": -200000, "KR": -4000000})
        self.assertEqual(o["hesapKodlari"], {"ZIR": "102.01", "KK": "309.01", "KR": "300.01"})
        self.assertEqual(o["mizan"]["780"], {"borc": 60000, "alacak": 0})
        self.assertEqual(o["mizan"]["649"], {"borc": 0, "alacak": 5000})
        self.assertEqual(o["mizan"]["659"], {"borc": 2000, "alacak": 0})
        self.assertEqual(o["mizan"]["320"], {"borc": 300000, "alacak": 0})
        self.assertEqual(o["cariler"]["XYZ"], 300000)
        self.assertEqual(o["ozet"], {"gercekBanka": 13843000, "hesabiAtanmamis": 0, "kartVeKrediBorcu": 4200000,
                                     "kasaVeGercekBanka": 13843000})
        self.assertEqual(o["eksiBakiyeDenetimi"], {"ZIR": "uyar", "KK": "uyar", "KR": "kontrol_yok"})
        mizan_dengede(self, o["mizan"])

    def test_ucretli_transfer(self):
        """PLAN §3.7 #11: EFT 5,00 + BSMV 0,25 → Ziraat 110.000 − 20.005,25 = 89.994,75; Garanti 70.000."""
        with open(os.path.join(SENARYOLAR, "kabul-1-16.json"), encoding="utf-8") as fh:
            s = json.load(fh)
        s["ad"] = "ucretli-transfer"
        for a in s["adimlar"]:
            if a["id"] == "15-16":
                a["ucret"] = "5"
                a["ucretVergi"] = "bsmv_haric"
        s["adimlar"] = [a for a in s["adimlar"] if a["id"] != "k15-16"]
        o = kos(s)
        self.assertEqual(o["bankaHesaplari"], {"ZIR": 8999475, "GAR": 7000000})
        self.assertEqual(o["mizan"]["770"], {"borc": 525, "alacak": 0})
        mizan_dengede(self, o["mizan"])

    def test_transfer_retleri(self):
        """PLAN Aşama 9: kaynak = hedef → 400; kredi hesabıyla transfer → 400 bank-account-invalid."""
        s = sen("transfer-ret", [
            hesap("1", "ZIR", "1000"),
            hesap("2", "KR", "0", tur="kredi", dog=False),
            {"id": "3", "islem": "transfer", "kaynak": "ZIR", "hedef": "ZIR", "tutar": "10"},
            {"id": "4", "islem": "transfer", "kaynak": "ZIR", "hedef": "KR", "tutar": "10"},
        ])
        o = kos(s)
        self.assertEqual(ret(o, "3"), {"adim": "3", "durum": 400, "kod": None, "kodDayanak": None})
        self.assertEqual(ret(o, "4")["kod"], "bank-account-invalid")


# ------------------------------------------------------------------ hesap seçimi (§5.2)

class HesapSecimi(unittest.TestCase):

    def test_hesapsiz_ve_vadeli(self):
        """§5.2/1: hiç uygun hesap yoksa 102.00; vadeli uygun değil; uygun yokken hesap verilirse 400 invalid."""
        s = sen("hesapsiz", [
            cari("1", "ABC"),
            {"id": "2", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "100", "yol": "havale"},
            hesap("3", "VDL", "0", tur="vadeli"),
            {"id": "4", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "50", "yol": "havale"},
            {"id": "5", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "50", "yol": "havale", "hesap": "VDL"},
        ])
        o = kos(s)
        self.assertEqual(o["mizan"]["102.00"], {"borc": 15000, "alacak": 0})
        self.assertEqual(o["ozet"]["hesabiAtanmamis"], 15000)
        self.assertEqual(o["ozet"]["gercekBanka"], 0)
        self.assertEqual(ret(o, "5"), {"adim": "5", "durum": 400, "kod": "bank-account-invalid",
                                       "kodDayanak": "CIKARIM"})

    def test_cok_hesap_zorunlu_tek_hesap_otomatik_pasif(self):
        """§5.2/2–4 [PLAN §3.5/3, Aşama 5 'Pasif hesap → 400']."""
        s = sen("hesap-secimi", [
            cari("1", "ABC"),
            hesap("2", "ZIR", "0"),
            hesap("3", "GAR", "0"),
            {"id": "4", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "10", "yol": "havale"},
            {"id": "5", "islem": "hesap_durum", "hesap": "GAR", "durum": "pasif"},
            {"id": "6", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "10", "yol": "havale"},
            {"id": "7", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "20", "yol": "havale", "hesap": "GAR"},
        ])
        o = kos(s)
        self.assertEqual(ret(o, "4"), {"adim": "4", "durum": 400, "kod": "bank-account-required",
                                       "kodDayanak": "PLAN"})
        self.assertIsNone(ret(o, "6"))
        self.assertEqual(o["bankaHesaplari"], {"ZIR": 1000, "GAR": 0})
        self.assertEqual(ret(o, "7")["kod"], "bank-account-invalid")


# ------------------------------------------------------------------ eksi bakiye (§5.3, K7)

class EksiBakiye(unittest.TestCase):

    def test_kabul_37_eszamanli_engelle(self):
        """PLAN §12.5 adım 37 (ilk yarı): Garanti 70.000 Engelle; XYZ ve KLM'ye aynı anda 40.000 → biri 409 cash-blocked."""
        s = sen("esz-engelle", [
            hesap("1", "GAR", "70000"),
            {"id": "2", "islem": "hesap_eksi_politika", "hesap": "GAR", "politika": "engelle"},
            cari("3", "XYZ", "tedarikci"),
            cari("4", "KLM", "tedarikci"),
            {"id": "5", "islem": "cari_odeme", "cari": "XYZ", "tutar": "40000", "yol": "havale", "hesap": "GAR",
             "kullanici": "M1", "ayniAnda": "a"},
            {"id": "6", "islem": "cari_odeme", "cari": "KLM", "tutar": "40000", "yol": "havale", "hesap": "GAR",
             "kullanici": "M2", "ayniAnda": "a"},
        ], kullanicilar={"M1": "muhasebe", "M2": "muhasebe"})
        o = kos(s)
        alts = o["alternatifler"]
        self.assertEqual(len(alts), 2)
        for a in alts:
            self.assertEqual(len(a["retler"]), 1)
            self.assertEqual(a["retler"][0]["durum"], 409)
            self.assertEqual(a["retler"][0]["kod"], "cash-blocked")
            self.assertEqual(a["bankaHesaplari"]["GAR"], 3000000)
        self.assertEqual({a["retler"][0]["adim"] for a in alts}, {"5", "6"})

    def test_uyar_yine_de_kaydet_ve_kontrol_yok(self):
        """§5.3: doğrulanmış hesapta Uyar → 409 cash-negative; Yine de Kaydet geçer; doğrulanmamışta denetim yok."""
        s = sen("uyar", [
            hesap("1", "ZIR", "1000"),
            hesap("2", "GAR", "1000", dog=False),
            cari("3", "XYZ", "tedarikci"),
            {"id": "4", "islem": "cari_odeme", "cari": "XYZ", "tutar": "1500", "yol": "havale", "hesap": "ZIR"},
            {"id": "5", "islem": "cari_odeme", "cari": "XYZ", "tutar": "1500", "yol": "havale", "hesap": "ZIR",
             "yineDeKaydet": True},
            {"id": "6", "islem": "cari_odeme", "cari": "XYZ", "tutar": "1600", "yol": "havale", "hesap": "GAR"},
        ])
        o = kos(s)
        self.assertEqual(ret(o, "4"), {"adim": "4", "durum": 409, "kod": "cash-negative", "kodDayanak": "CIKARIM"})
        self.assertEqual(o["bankaHesaplari"], {"ZIR": -50000, "GAR": -60000})
        self.assertEqual(o["eksiBakiyeDenetimi"], {"ZIR": "uyar", "GAR": "kontrol_yok"})

    def test_kmh_limiti(self):
        """PLAN K7 'KMH limitine kadar serbest'; §3.7 #1 'KMH'de eksi açılış ters'."""
        s = sen("kmh", [
            hesap("1", "ZIR", "-500", kmhLimiti="1000"),
            cari("2", "XYZ", "tedarikci"),
            {"id": "3", "islem": "cari_odeme", "cari": "XYZ", "tutar": "400", "yol": "havale"},
            {"id": "4", "islem": "cari_odeme", "cari": "XYZ", "tutar": "200", "yol": "havale"},
        ])
        o = kos(s)
        self.assertIsNone(ret(o, "3"))
        self.assertEqual(ret(o, "4")["kod"], "cash-negative")
        self.assertEqual(o["mizan"]["102.01"], {"borc": 0, "alacak": 90000})
        self.assertEqual(o["mizan"]["500"], {"borc": 50000, "alacak": 0})

    def test_min_formulu_gecmis_tarih(self):
        """PLAN §3.9: Bakiye = min(işlem günündeki bakiye, bütün hareketlerle bakiye) + limit."""
        s = sen("min-formulu", [
            hesap("1", "ZIR", "1000"),
            cari("2", "ABC"),
            cari("3", "XYZ", "tedarikci"),
            {"id": "4", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "5000", "yol": "havale"},
            {"id": "5", "islem": "cari_odeme", "cari": "XYZ", "tutar": "2000", "yol": "havale", "tarih": "05.10.2026"},
            {"id": "6", "islem": "cari_odeme", "cari": "XYZ", "tutar": "2000", "yol": "havale"},
        ])
        o = kos(s)
        # 05.10'da bakiye 1.000 − 2.000 = −1.000 < 0 → ihlal (bütün hareketlerle 4.000 olsa da)
        self.assertEqual(ret(o, "5")["kod"], "cash-negative")
        self.assertIsNone(ret(o, "6"))
        self.assertEqual(o["bankaHesaplari"]["ZIR"], 400000)

    def test_kasa_engelle(self):
        """§4.8, §4.9 [PLAN §2.3 'Elle Kasa girişi 100 ↔ 649/770']; Kasa Engelle."""
        s = sen("kasa", [
            {"id": "1", "islem": "kasa_acilis", "tutar": "1000"},
            {"id": "2", "islem": "kasa_hareket", "yon": "giris", "tutar": "200", "aciklama": "Kira geliri"},
            {"id": "3", "islem": "kasa_hareket", "yon": "cikis", "tutar": "500", "aciklama": "Kırtasiye"},
            {"id": "4", "islem": "kasa_hareket", "yon": "cikis", "tutar": "900", "aciklama": "Fazla çıkış"},
        ], ayarlar={"kasaEksiBakiye": "engelle"})
        o = kos(s)
        self.assertEqual(o["kasa"], 70000)
        self.assertEqual(o["mizan"]["649"], {"borc": 0, "alacak": 20000})
        self.assertEqual(o["mizan"]["770"], {"borc": 50000, "alacak": 0})
        self.assertEqual(o["mizan"]["500"], {"borc": 0, "alacak": 100000})
        self.assertEqual(ret(o, "4"), {"adim": "4", "durum": 409, "kod": "cash-blocked", "kodDayanak": "PLAN"})

    def test_silme_eksi_bakiye(self):
        """PLAN §9.2/4 'azalan her hesapta son durum eksi bakiye denetlenir'; Aşama 0 silme → Uyar'da 409."""
        s = sen("sil-eksi", [
            hesap("1", "ZIR", "0"),
            cari("2", "ABC"),
            cari("3", "XYZ", "tedarikci"),
            {"id": "4", "islem": "cari_tahsilat", "ad": "TH1", "cari": "ABC", "tutar": "1000", "yol": "havale"},
            {"id": "5", "islem": "cari_odeme", "cari": "XYZ", "tutar": "800", "yol": "havale"},
            {"id": "6", "islem": "sil", "hedef": "TH1"},
        ])
        o = kos(s)
        self.assertEqual(ret(o, "6")["kod"], "cash-negative")
        self.assertEqual(o["bankaHesaplari"]["ZIR"], 20000)


# ------------------------------------------------------------------ mükerrer (§5.4)

class Mukerrer(unittest.TestCase):

    def test_istek_kimligi(self):
        """PLAN §3.10/1: aynı kimlik + aynı gövde → yinelenen; farklı gövde → 409."""
        s = sen("istek", [
            hesap("1", "ZIR", "0"),
            cari("2", "ABC"),
            {"id": "3", "islem": "cari_tahsilat", "ad": "T1", "cari": "ABC", "tutar": "100", "yol": "havale",
             "istekKimligi": "k1"},
            {"id": "4", "islem": "cari_tahsilat", "ad": "T2", "cari": "ABC", "tutar": "100", "yol": "havale",
             "istekKimligi": "k1"},
            {"id": "5", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "101", "yol": "havale",
             "istekKimligi": "k1"},
            {"id": "6", "islem": "sil", "hedef": "T2"},
            {"id": "7", "islem": "sil", "hedef": "T1"},
        ])
        o = kos(s)
        self.assertEqual(o["yinelenenler"], ["4"])
        self.assertEqual(ret(o, "5"), {"adim": "5", "durum": 409, "kod": None, "kodDayanak": None})
        # T2 yinelenen adımın adı → T1'in hareketi; ikinci silme 404
        self.assertEqual(ret(o, "7")["durum"], 404)
        self.assertEqual(o["bankaHesaplari"]["ZIR"], 0)

    def test_benzer_islem(self):
        """PLAN §3.10/2: aynı gün, aynı hesap/cari/tutar/hedef → 409 bank-similar; nakit denetlenmez."""
        s = sen("benzer", [
            hesap("1", "ZIR", "0"),
            cari("2", "ABC"),
            {"id": "3", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "100", "yol": "havale"},
            {"id": "4", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "100", "yol": "havale"},
            {"id": "5", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "100", "yol": "havale", "benzerOnay": True},
            {"id": "6", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "100", "yol": "nakit"},
            {"id": "7", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "100", "yol": "nakit"},
            {"id": "8", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "100", "yol": "havale",
             "tarih": "07.10.2026"},
        ])
        o = kos(s)
        self.assertEqual([r["adim"] for r in o["retler"]], ["4"])
        self.assertEqual(ret(o, "4"), {"adim": "4", "durum": 409, "kod": "bank-similar", "kodDayanak": "PLAN"})
        self.assertEqual(o["bankaHesaplari"]["ZIR"], 30000)
        self.assertEqual(o["kasa"], 20000)

    def test_benzer_kapali(self):
        s = sen("benzer-kapali", [
            hesap("1", "ZIR", "0"),
            cari("2", "ABC"),
            {"id": "3", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "100", "yol": "havale"},
            {"id": "4", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "100", "yol": "havale"},
        ], ayarlar={"benzerIslemUyarisi": "kapali"})
        self.assertEqual(kos(s)["retler"], [])


# ------------------------------------------------------------------ yetki (§5.5)

class Yetki(unittest.TestCase):

    def test_personel(self):
        """PLAN §12.5 adım 36: transfer 403; kendi havale tahsilatını silme 403; tahsilat girişi 200."""
        s = sen("personel", [
            hesap("1", "ZIR", "1000"),
            hesap("2", "GAR", "1000"),
            cari("3", "ABC"),
            {"id": "4", "islem": "cari_tahsilat", "ad": "PH", "cari": "ABC", "tutar": "100", "yol": "havale",
             "hesap": "ZIR", "kullanici": "P"},
            {"id": "5", "islem": "transfer", "kaynak": "ZIR", "hedef": "GAR", "tutar": "10", "kullanici": "P"},
            {"id": "6", "islem": "sil", "hedef": "PH", "kullanici": "P"},
            {"id": "7", "islem": "cari_tahsilat", "ad": "PN", "cari": "ABC", "tutar": "50", "yol": "nakit",
             "kullanici": "P"},
            {"id": "8", "islem": "sil", "hedef": "PN", "kullanici": "P"},
            {"id": "9", "islem": "hesap_ac", "ad": "HX", "banka": "X", "hesapAdi": "Y", "tur": "vadesiz",
             "paraBirimi": "TRY", "acilisTarihi": "01.10.2026", "acilisBakiyesi": "0", "kullanici": "P"},
            {"id": "10", "islem": "diger_gelir", "hesap": "HX", "tutar": "5"},
        ], ayarlar={"kasaEksiBakiye": "uyar"}, kullanicilar={"P": "personel"})
        o = kos(s)
        self.assertEqual(ret(o, "5")["durum"], 403)
        self.assertEqual(ret(o, "6")["durum"], 403)
        self.assertIsNone(ret(o, "8"))
        self.assertEqual(ret(o, "9")["durum"], 403)
        self.assertEqual(o["atlananlar"], ["10"])   # HX hiç oluşmadı
        self.assertEqual(o["bankaHesaplari"]["ZIR"], 110000)
        self.assertEqual(o["kasa"], 0)

    def test_planda_olmayan_birlesim_senaryo_hatasi(self):
        """BELİRSİZ-18: muhasebe Kasa↔Banka → planda yok → senaryo geçersiz (çıkış 2)."""
        s = sen("muhasebe-kasa", [
            hesap("1", "ZIR", "1000"),
            {"id": "2", "islem": "kasa_banka", "yon": "bankadan_kasaya", "tutar": "10", "kullanici": "M"},
        ], kullanicilar={"M": "muhasebe"})
        kod, out, err = kos_cli(s)
        self.assertEqual(kod, 2)
        self.assertEqual(out, "")
        self.assertIn("BELİRSİZ-18", err)


# ------------------------------------------------------------------ tarih ve kilit (§5.1, §4.3)

class TarihKilit(unittest.TestCase):

    def test_ileri_tarih_kilit_acilis_oncesi(self):
        s = sen("tarih", [
            hesap("1", "ZIR", "1000", tarih="05.10.2026"),
            cari("2", "ABC"),
            {"id": "3", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "10", "yol": "havale",
             "tarih": "09.10.2026"},
            {"id": "4", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "10", "yol": "havale",
             "tarih": "02.10.2026"},
            {"id": "5", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "10", "yol": "havale",
             "tarih": "05.10.2026"},
            {"id": "6", "islem": "diger_gelir", "ad": "DG", "hesap": "ZIR", "tutar": "7", "tarih": "06.10.2026"},
            {"id": "7", "islem": "donem_kilidi", "kilitTarihi": "06.10.2026"},
            {"id": "8", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "11", "yol": "nakit",
             "tarih": "06.10.2026"},
            {"id": "9", "islem": "ters_kayit", "hedef": "DG"},
            {"id": "k", "islem": "kontrol"},
            hesap("10", "GAR", "5", tarih="04.10.2026"),
        ])
        o = kos(s)
        self.assertEqual(ret(o, "3"), {"adim": "3", "durum": 400, "kod": None, "kodDayanak": None})
        self.assertEqual(ret(o, "4"), {"adim": "4", "durum": "4xx", "kod": "bank-before-opening",
                                       "kodDayanak": "CIKARIM"})
        self.assertIsNone(ret(o, "5"))   # açılış günü dahil izinli
        self.assertEqual(ret(o, "8"), {"adim": "8", "durum": 409, "kod": "period-locked", "kodDayanak": "CIKARIM"})
        self.assertIsNone(ret(o, "9"))   # kilitli fişin tersi bugün tarihli
        self.assertEqual(ret(o, "10")["kod"], "period-locked")
        self.assertEqual(o["mizan"]["649"], {"borc": 0, "alacak": 0})
        self.assertEqual(o["bankaHesaplari"]["ZIR"], 101000)

    def test_acilis_duzelt(self):
        """PLAN §3.8: Açılışı Düzelt = ters + yeni; ilk hareketten sonraya → 409 bank-opening-after-first."""
        s = sen("acilis-duzelt", [
            hesap("1", "ZIR", "1000"),
            cari("2", "ABC"),
            {"id": "3", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "100", "yol": "havale",
             "tarih": "06.10.2026"},
            {"id": "4", "islem": "acilis_duzelt", "hesap": "ZIR", "acilisTarihi": "07.10.2026",
             "acilisBakiyesi": "1000"},
            {"id": "5", "islem": "acilis_duzelt", "hesap": "ZIR", "acilisTarihi": "02.10.2026",
             "acilisBakiyesi": "2000"},
            {"id": "6", "islem": "acilis_duzelt", "hesap": "ZIR", "acilisTarihi": "06.10.2026",
             "acilisBakiyesi": "2500"},
        ])
        o = kos(s)
        self.assertEqual(ret(o, "4"), {"adim": "4", "durum": 409, "kod": "bank-opening-after-first",
                                       "kodDayanak": "PLAN"})
        self.assertIsNone(ret(o, "5"))
        self.assertIsNone(ret(o, "6"))  # "art arda iki kez → 200" (Aşama 3); açılış günü = ilk hareket günü
        self.assertEqual(o["bankaHesaplari"]["ZIR"], 260000)
        self.assertEqual(o["mizan"]["500"], {"borc": 0, "alacak": 250000})


# ------------------------------------------------------------------ fatura, iade, açık (§4.13, §4.14, §7)

class FaturaIade(unittest.TestCase):

    def test_iskonto_ve_kdv_haric(self):
        """§6.3: hariç: M = brüt − iskonto, K = rh(M·r/100); dahil iskontolu: H = rh(brüt·100/(100+r))."""
        s = sen("iskonto", [
            cari("1", "ABC"),
            {"id": "2", "islem": "fatura", "ad": "F1", "tur": "satis", "cari": "ABC", "kalemler": [
                {"hizmet": "A", "miktar": 1, "birimFiyat": "1000", "kdvOrani": 20, "kdvDahil": False,
                 "iskontoOrani": "10"},
                {"hizmet": "B", "miktar": 1, "birimFiyat": "2000", "kdvOrani": 10, "kdvDahil": True,
                 "iskontoOrani": "10"},
                {"hizmet": "C", "miktar": 3, "birimFiyat": "33,33", "kdvOrani": 1, "kdvDahil": True},
                {"hizmet": "D", "miktar": 1, "birimFiyat": "100,05", "kdvOrani": 20, "kdvDahil": True},
            ]},
        ])
        o = kos(s)
        # A: M 90.000, K 18.000, T 108.000
        # B: H = rh(20.000.000, 110) = 181.818; M = 181.818 − rh(181.818.000, 10.000) = 181.818 − 18.182 = 163.636;
        #    K = rh(1.636.360, 100) = 16.364; T = 180.000
        # C: brüt 9.999; M = rh(999.900, 101) = 9.900; K = 99; T = 9.999
        # D: brüt 10.005; M = rh(1.000.500, 120) = 8.338 (8.337,5 yukarı); K = brüt − M = 1.667 (PLAN §12.5 adım 6
        #    kalıbı: KDV = toplam − matrah). rh(M·20/100) = 1.668 olurdu — bu kalem iki yorumu ayırır.
        self.assertEqual(o["faturalar"]["F1"], {"toplam": 108000 + 180000 + 9999 + 10005,
                                                "matrah": 90000 + 163636 + 9900 + 8338,
                                                "kdv": 18000 + 16364 + 99 + 1667,
                                                "acik": 108000 + 180000 + 9999 + 10005})

    def test_iade_plan_adim_27(self):
        """PLAN §12.5 adım 27 ve 33 mizanı: Ürün B 3 × 1.000 KDV %20 dahil = 3.000 → 610 2.500, 391 borç 500."""
        s = sen("iade", [
            {"id": "1", "islem": "urun_ac", "ad": "URB", "urunAdi": "Ürün B", "birim": "Adet"},
            {"id": "2", "islem": "stok_giris", "urun": "URB", "miktar": 25},
            cari("3", "ABC"),
            hesap("4", "ZIR", "0", dog=False),
            {"id": "5", "islem": "fatura", "ad": "F2", "tur": "satis", "cari": "ABC", "tarih": "07.10.2026",
             "kalemler": [{"urun": "URB", "miktar": 10, "birimFiyat": "1000", "kdvOrani": 20, "kdvDahil": True}]},
            {"id": "6", "islem": "iade", "ad": "IA", "asilFatura": "F2", "kalemler": [{"kalem": 1, "miktar": 3}],
             "geri": {"yol": "acik"}},
            {"id": "k6", "islem": "kontrol"},
            {"id": "7", "islem": "iade", "ad": "IB", "asilFatura": "F2", "kalemler": [{"kalem": 1, "miktar": 2}],
             "geri": {"yol": "havale"}},
            {"id": "8", "islem": "iade", "ad": "IC", "asilFatura": "F2", "kalemler": [{"kalem": 1, "miktar": 6}],
             "geri": {"yol": "acik"}},
            {"id": "9", "islem": "iade", "ad": "ID", "asilFatura": "F2", "tarih": "06.10.2026",
             "kalemler": [{"kalem": 1, "miktar": 1}], "geri": {"yol": "acik"}},
        ])
        o = kos(s)
        k6 = o["araDurumlar"]["k6"]
        self.assertEqual(k6["faturalar"]["IA"], {"toplam": 300000, "matrah": 250000, "kdv": 50000, "acik": 0})
        self.assertEqual(k6["faturalar"]["F2"]["acik"], 700000)
        self.assertEqual(k6["mizan"]["610"], {"borc": 250000, "alacak": 0})
        self.assertEqual(k6["mizan"]["391"], {"borc": 0, "alacak": 166667 - 50000})
        self.assertEqual(k6["stok"]["URB"], 18)
        self.assertEqual(k6["cariler"]["ABC"], 700000)
        # IB: 2 adet geri havale → banka −2.000, belge açığı 0, F2 açığı değişmez
        self.assertEqual(o["faturalar"]["IB"], {"toplam": 200000, "matrah": 166667, "kdv": 33333, "acik": 0})
        self.assertEqual(o["bankaHesaplari"]["ZIR"], -200000)
        self.assertEqual(o["faturalar"]["F2"]["acik"], 700000)
        self.assertEqual(o["stok"]["URB"], 20)
        self.assertEqual(ret(o, "8")["durum"], "4xx")   # 3 + 2 + 6 > 10
        self.assertEqual(ret(o, "9")["durum"], "4xx")   # iade tarihi asıldan önce
        mizan_dengede(self, o["mizan"])

    def test_fifo_ve_kapatilacak_fatura(self):
        """§7 kural 4 ve 6 [PLAN §8.10 'Otomatik (En Eski)']; cari değişmezi."""
        s = sen("fifo", [
            cari("1", "ABC"),
            hizmet_satis("2", "F1", "ABC", "1000", dahil=False, tarih="01.10.2026"),     # T 120.000
            hizmet_satis("3", "F2", "ABC", "500", kdv=10, dahil=False, tarih="02.10.2026"),  # T 55.000
            {"id": "4", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "1500", "yol": "nakit"},
            hizmet_satis("5", "F3", "ABC", "100", tarih="03.10.2026"),                    # T 10.000
            {"id": "6", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "50", "yol": "nakit",
             "kapatilacakFatura": "F3"},
        ])
        o = kos(s)
        self.assertEqual(o["faturalar"]["F1"]["acik"], 0)
        self.assertEqual(o["faturalar"]["F2"]["acik"], 25000)
        self.assertEqual(o["faturalar"]["F3"]["acik"], 5000)
        self.assertEqual(o["cariler"]["ABC"], 30000)
        self.assertEqual(o["belirsizler"], [])

    def test_bagli_tutar_acigi_asarsa_senaryo_hatasi(self):
        """BELİRSİZ-10: bağlı ödemenin belge açığını aşması senaryoda kurulmaz."""
        s = sen("bagli-asim", [
            cari("1", "ABC"),
            hizmet_satis("2", "F1", "ABC", "100"),
            {"id": "3", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "101", "yol": "nakit",
             "kapatilacakFatura": "F1"},
        ])
        kod, out, err = kos_cli(s)
        self.assertEqual(kod, 2)
        self.assertIn("BELİRSİZ-10", err)

    def test_taksit(self):
        """§4.13 taksit + §4.17 [PLAN §3.7 #6, talimat 11]: kart toplam = T − peşin; fatura açığı = kart kalanı."""
        s = sen("taksit", [
            hesap("1", "ZIR", "0"),
            cari("2", "ABC"),
            hizmet_satis("3", "F", "ABC", "1200", odeme={"pesin": [{"yol": "nakit", "tutar": "200"}],
                                                          "taksit": {"ad": "T1", "sayi": 2}}),
            {"id": "4", "islem": "taksit_tahsilat", "ad": "TT", "kart": "T1", "tutar": "300", "yol": "havale"},
            {"id": "k4", "islem": "kontrol"},
            {"id": "5", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "10", "yol": "nakit"},
        ])
        o = kos(s)
        k4 = o["araDurumlar"]["k4"]
        self.assertEqual(k4["taksitKartlari"]["T1"], {"toplam": 100000, "odenen": 30000, "kalan": 70000})
        self.assertEqual(k4["faturalar"]["F"]["acik"], 70000)
        self.assertEqual(k4["cariler"]["ABC"], 70000)
        self.assertEqual(k4["kasa"], 20000)
        self.assertEqual(k4["bankaHesaplari"]["ZIR"], 30000)
        # 5: taksitli faturası olan caride bağsız tahsilat → BELİRSİZ-7
        alanlar = {b["alan"] for b in o["belirsizler"]}
        self.assertIn("faturalar.F.acik", alanlar)
        self.assertIn("taksitKartlari.T1.kalan", alanlar)
        self.assertNotIn("araDurumlar.k4.faturalar.F.acik", alanlar)

    def test_taksit_kalani_asma_senaryo_hatasi(self):
        s = sen("taksit-asim", [
            cari("1", "ABC"),
            hizmet_satis("2", "F", "ABC", "100", odeme={"taksit": {"ad": "T1", "sayi": 1}}),
            {"id": "3", "islem": "taksit_tahsilat", "kart": "T1", "tutar": "101", "yol": "nakit"},
        ])
        kod, _, err = kos_cli(s)
        self.assertEqual(kod, 2)
        self.assertIn("BELİRSİZ-6", err)

    def test_silme_ve_404_ve_fatura_acigi(self):
        s = sen("silme", [
            hesap("1", "ZIR", "0"),
            cari("2", "ABC"),
            hizmet_satis("3", "F1", "ABC", "1000"),
            {"id": "4", "islem": "cari_tahsilat", "ad": "TH1", "cari": "ABC", "tutar": "1000", "yol": "havale"},
            {"id": "k4", "islem": "kontrol"},
            {"id": "5", "islem": "sil", "hedef": "TH1"},
            {"id": "6", "islem": "sil", "hedef": "TH1"},
        ])
        o = kos(s)
        self.assertEqual(o["araDurumlar"]["k4"]["faturalar"]["F1"]["acik"], 0)
        self.assertEqual(o["faturalar"]["F1"]["acik"], 100000)
        self.assertEqual(o["cariler"]["ABC"], 100000)
        self.assertEqual(o["bankaHesaplari"]["ZIR"], 0)
        self.assertEqual(ret(o, "6"), {"adim": "6", "durum": 404, "kod": None, "kodDayanak": None})

    def test_alis_stoklu_satis_621_belirsiz(self):
        """BELİRSİZ-15: stoklu alışı yapılmış ürün satılırsa mizan.153 ve mizan.621 belirsiz."""
        s = sen("maliyet", [
            {"id": "1", "islem": "urun_ac", "ad": "URA", "urunAdi": "Ürün A", "birim": "Adet"},
            cari("2", "XYZ", "tedarikci"),
            cari("3", "ABC"),
            {"id": "4", "islem": "fatura", "ad": "A1", "tur": "alis", "cari": "XYZ", "kalemler": [
                {"urun": "URA", "miktar": 5, "birimFiyat": "100", "kdvOrani": 20, "kdvDahil": False}]},
            {"id": "k4", "islem": "kontrol"},
            {"id": "5", "islem": "fatura", "ad": "S1", "tur": "satis", "cari": "ABC", "kalemler": [
                {"urun": "URA", "miktar": 1, "birimFiyat": "240", "kdvOrani": 20, "kdvDahil": True}]},
        ])
        o = kos(s)
        k4 = o["araDurumlar"]["k4"]
        self.assertEqual(k4["mizan"]["153"], {"borc": 50000, "alacak": 0})
        self.assertEqual(k4["mizan"]["191"], {"borc": 10000, "alacak": 0})
        self.assertEqual(k4["cariler"]["XYZ"], -60000)
        alanlar = {b["alan"] for b in o["belirsizler"]}
        self.assertIn("mizan.153", alanlar)
        self.assertIn("mizan.621", alanlar)
        self.assertNotIn("araDurumlar.k4.mizan.153", alanlar)
        self.assertEqual(o["stok"]["URA"], 4)

    def test_eksi_stok_senaryo_hatasi(self):
        s = sen("eksi-stok", [
            {"id": "1", "islem": "urun_ac", "ad": "URA", "urunAdi": "Ürün A", "birim": "Adet"},
            cari("2", "ABC"),
            {"id": "3", "islem": "fatura", "ad": "S1", "tur": "satis", "cari": "ABC", "kalemler": [
                {"urun": "URA", "miktar": 1, "birimFiyat": "10", "kdvOrani": 20, "kdvDahil": True}]},
        ])
        kod, _, err = kos_cli(s)
        self.assertEqual(kod, 2)
        self.assertIn("BELİRSİZ-14", err)


# ------------------------------------------------------------------ ham tutar, çoklu ihlal, atlananlar

class HamVeRetler(unittest.TestCase):

    def test_ham_tutarlar(self):
        """§6.2: modül ucu 3 ondalık rh ile yuvarlanır; banka ucu 400; sıfır/eksi 400."""
        s = sen("ham", [
            hesap("1", "ZIR", "1000"),
            cari("2", "ABC"),
            {"id": "3", "islem": "cari_tahsilat", "cari": "ABC", "tutarHam": "1,005", "yol": "nakit"},
            {"id": "4", "islem": "banka_masraf", "hesap": "ZIR", "tutarHam": "10,505", "masrafTuru": "EFT",
             "vergi": "yok"},
            {"id": "5", "islem": "diger_gelir", "hesap": "ZIR", "tutarHam": "0"},
            {"id": "6", "islem": "cari_tahsilat", "cari": "ABC", "tutarHam": "0,004", "yol": "nakit"},
            {"id": "7", "islem": "cari_tahsilat", "cari": "ABC", "tutarHam": "-5", "yol": "nakit"},
            {"id": "8", "islem": "diger_gelir", "hesap": "ZIR", "tutarHam": "1,5"},
            {"id": "9", "islem": "hesap_ac", "ad": "HX", "banka": "X", "hesapAdi": "Y", "tur": "vadesiz",
             "paraBirimi": "TRY", "acilisTarihi": "01.10.2026", "acilisBakiyesiHam": "100,001"},
            {"id": "10", "islem": "diger_gelir", "hesap": "HX", "tutar": "1"},
        ])
        o = kos(s)
        self.assertEqual(o["kasa"], 101)
        for a in ("4", "5", "6", "7", "9"):
            self.assertEqual(ret(o, a), {"adim": a, "durum": 400, "kod": None, "kodDayanak": None}, a)
        self.assertEqual(o["bankaHesaplari"]["ZIR"], 100150)
        self.assertEqual(o["atlananlar"], ["10"])
        self.assertNotIn("HX", o["bankaHesaplari"])

    def test_birden_cok_ihlal(self):
        """§5.6 / BELİRSİZ-17: ileri tarih (400) + hesap seçilmedi (400 bank-account-required) → yalnız 4xx sınıfı."""
        s = sen("cok-ihlal", [
            hesap("1", "ZIR", "0"),
            hesap("2", "GAR", "0"),
            cari("3", "ABC"),
            {"id": "4", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "10", "yol": "havale",
             "tarih": "09.10.2026"},
        ])
        o = kos(s)
        self.assertEqual(ret(o, "4"), {"adim": "4", "durum": "4xx", "kod": None, "kodDayanak": None})
        self.assertTrue(any(b["alan"] == "retler.4" and b["neden"].startswith("BELİRSİZ-17")
                            for b in o["belirsizler"]))

    def test_ters_kaydedilemeyen_ve_silinemeyen(self):
        s = sen("ters-sil", [
            hesap("1", "ZIR", "1000"),
            hesap("2", "GAR", "0"),
            cari("3", "ABC"),
            {"id": "4", "islem": "cari_tahsilat", "ad": "TH", "cari": "ABC", "tutar": "10", "yol": "havale",
             "hesap": "ZIR"},
            {"id": "5", "islem": "transfer", "ad": "TR", "kaynak": "ZIR", "hedef": "GAR", "tutar": "300"},
            {"id": "6", "islem": "ters_kayit", "hedef": "TH"},
            {"id": "7", "islem": "sil", "hedef": "TR"},
            {"id": "8", "islem": "ters_kayit", "hedef": "TR"},
            {"id": "9", "islem": "ters_kayit", "hedef": "TR"},
        ])
        o = kos(s)
        self.assertEqual(ret(o, "6")["durum"], "4xx")
        self.assertEqual(ret(o, "7")["durum"], "4xx")
        self.assertIsNone(ret(o, "8"))
        self.assertEqual(ret(o, "9")["durum"], 409)
        self.assertEqual(o["bankaHesaplari"], {"ZIR": 101000, "GAR": 0})

    def test_yinelenen_fatura_takma_adi(self):
        """§5.4: yinelenen adımın `ad`'ı önceki adımın varlığını anar; çıktıda ilk ad kullanılır."""
        s = sen("yinelenen-fatura", [
            cari("1", "ABC"),
            hizmet_satis("2", "F1", "ABC", "100", istekKimligi="f"),
            hizmet_satis("3", "F2", "ABC", "100", istekKimligi="f"),
            {"id": "4", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "40", "yol": "nakit",
             "kapatilacakFatura": "F2"},
        ])
        o = kos(s)
        self.assertEqual(o["yinelenenler"], ["3"])
        self.assertEqual(list(o["faturalar"]), ["F1"])
        self.assertEqual(o["faturalar"]["F1"]["acik"], 6000)


# ------------------------------------------------------------------ senaryo geçerliliği (§13)

class Gecerlilik(unittest.TestCase):

    def test_gecersizler(self):
        taban = [hesap("1", "ZIR", "1000"), cari("2", "ABC")]
        vakalar = {
            "bilinmeyen-alan": taban + [{"id": "3", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "1",
                                         "yol": "nakit", "uydurma": 1}],
            "tanimsiz-ad": taban + [{"id": "3", "islem": "cari_tahsilat", "cari": "XYZ", "tutar": "1",
                                     "yol": "nakit"}],
            "kasa-politikasiz": taban + [cari("3", "XYZ", "tedarikci"),
                                         {"id": "4", "islem": "cari_odeme", "cari": "XYZ", "tutar": "1",
                                          "yol": "nakit"}],
            "hafta-sonu": taban + [{"id": "3", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "1",
                                    "yol": "havale", "tarih": "04.10.2026"}],
            "belirsiz4": taban + [
                {"id": "3", "islem": "diger_gelir", "hesap": "ZIR", "tutar": "5"},
                {"id": "4", "islem": "diger_gider", "hesap": "ZIR", "tutar": "5"}],
            "tutar-bicimi": taban + [{"id": "3", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "1.000",
                                      "yol": "nakit"}],
        }
        for ad, adimlar in vakalar.items():
            with self.subTest(ad):
                kod, out, err = kos_cli(sen(ad, adimlar))
                self.assertEqual(kod, 2, err)
                self.assertEqual(out, "")

    def test_ad_dosya_adi(self):
        s = sen("bir-ad", [cari("1", "ABC")])
        with tempfile.TemporaryDirectory() as d:
            yol = os.path.join(d, "baska-ad.json")
            with open(yol, "w", encoding="utf-8") as fh:
                json.dump(s, fh)
            p = subprocess.run([sys.executable, "-I", MODEL_YOLU, yol], capture_output=True, text=True)
        self.assertEqual(p.returncode, 2)

    def test_kullanim(self):
        p = subprocess.run([sys.executable, "-I", MODEL_YOLU], capture_output=True, text=True)
        self.assertEqual(p.returncode, 1)


if __name__ == "__main__":
    unittest.main()
