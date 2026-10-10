#!/usr/bin/env python3
"""model_b birim ve senaryo testleri (unittest, yalnız standart kütüphane).

Koşu:  python3 -I test/bagimsiz/model_b/test_model.py      (ya da -v)

Beklenen sayılar planın kendi sayılarıdır (docs/BANKA-MODULU-PLAN.md §3.7, §12.5; talimat madde 7, 11) ya da plan
kurallarıyla elle hesaplanmıştır; hesap yorumu her testin üstünde. Kâhinin kendi çıktısından türetilmiş beklenen YOKTUR.
"""

import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import unittest

BURASI = os.path.dirname(os.path.abspath(__file__))
KOK = os.path.abspath(os.path.join(BURASI, "..", "..", ".."))
MODEL = os.path.join(BURASI, "model.py")
KABUL = os.path.join(KOK, "test", "bagimsiz", "senaryolar", "kabul-1-16.json")

_spec = importlib.util.spec_from_file_location("model_b", MODEL)
m = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(m)


def senaryo(ad, adimlar, bugun="08.10.2026", ayarlar=None, kullanicilar=None):
    b = {"bugun": bugun, "sirket": "bos"}
    if ayarlar:
        b["ayarlar"] = ayarlar
    if kullanicilar:
        b["kullanicilar"] = kullanicilar
    return {"dil": m.DIL, "ad": ad, "baslangic": b, "adimlar": adimlar}


def kos(ad, adimlar, **kw):
    sen = senaryo(ad, adimlar, **kw)
    return m.kos(sen, ad + ".json")


def mizan_dengede(test, cikti):
    borc = sum(v["borc"] for v in cikti["mizan"].values())
    alacak = sum(v["alacak"] for v in cikti["mizan"].values())
    test.assertEqual(borc, alacak, "mizan dengesi")


def miz(cikti, kod):
    return cikti["mizan"].get(kod, {"borc": 0, "alacak": 0})


def hesap(ad, banka, tur="vadesiz", acilis="01.10.2026", bakiye="100000", dogru=True, **ek):
    a = {"id": "h-" + ad.lower(), "islem": "hesap_ac", "ad": ad, "banka": banka, "hesapAdi": "Ana TL Hesabı",
         "tur": tur, "paraBirimi": "TRY", "acilisTarihi": acilis, "acilisBakiyesi": bakiye, "bakiyeDogrulandi": dogru}
    a.update(ek)
    return a


def cari(ad, tur="musteri"):
    return {"id": "c-" + ad.lower(), "islem": "cari_ac", "ad": ad, "unvan": ad + " Ltd.", "tur": tur}


def urun(ad, miktar):
    return [{"id": "u-" + ad.lower(), "islem": "urun_ac", "ad": ad, "urunAdi": ad, "birim": "Adet"},
            {"id": "s-" + ad.lower(), "islem": "stok_giris", "urun": ad, "miktar": miktar}]


def ret_of(cikti, adim):
    for r in cikti["retler"]:
        if r["adim"] == adim:
            return r
    return None


# ═══════════════════════════════════════════════════════════════════════════════════ temel hesaplar

class TemelHesaplar(unittest.TestCase):
    def test_rh_plan_ornekleri(self):
        # SENARYO-DILI §6.1: rh(2000000×100, 120) = 1666667 (16.666,67); rh(1050, 105) = 10
        self.assertEqual(m.rh(2000000 * 100, 120), 1666667)
        self.assertEqual(m.rh(1050, 105), 10)
        # yarım birim sıfırdan uzağa: 2,5 → 3 ; 1,5 → 2
        self.assertEqual(m.rh(5, 2), 3)
        self.assertEqual(m.rh(3, 2), 2)
        with self.assertRaises(m.KahinHatasi):
            m.rh(-1, 2)

    def test_kalem_kdv_dahil_plan_adim6(self):
        # PLAN §12.5 adım 6: 20.000 KDV %20 dahil → Matrah 16.666,67 · KDV 3.333,33 · Toplam 20.000
        self.assertEqual(m.kalem_hesapla(1, 2000000, 20, 0, True), (1666667, 333333, 2000000))

    def test_kalem_toplamdan_yuvarlama_plan_mizani(self):
        # PLAN §12.5 adım 33 mizanı: 600 = 35.000,00 → Ürün B 10 × 1.000 dahil = 8.333,33 (toplamdan)
        self.assertEqual(m.kalem_hesapla(10, 100000, 20, 0, True), (833333, 166667, 1000000))
        self.assertEqual(m.kalem_hesapla(12, 100000, 20, 0, True), (1000000, 200000, 1200000))
        # iade 3 × 1.000 → 610 = 2.500
        self.assertEqual(m.kalem_hesapla(3, 100000, 20, 0, True), (250000, 50000, 300000))

    def test_kalem_haric_ve_iskonto(self):
        # KDV hariç 1.000 %20 → 1.000 + 200 ; iskonto %10 → 900 + 180
        self.assertEqual(m.kalem_hesapla(1, 100000, 20, 0, False), (100000, 20000, 120000))
        self.assertEqual(m.kalem_hesapla(1, 100000, 20, 1000, False), (90000, 18000, 108000))
        # KDV dahil iskontolu: H = rh(120000×100,120)=100000; M = 100000 − 10000 = 90000; K = 18000
        self.assertEqual(m.kalem_hesapla(1, 120000, 20, 1000, True), (90000, 18000, 108000))

    def test_ham_coz(self):
        self.assertIsNone(m.ham_coz("10,005", "banka"))           # PLAN §5.1: 3 ondalık → 400
        self.assertEqual(m.ham_coz("1,005", "modul"), 101)        # PLAN §2.1: yarım kuruş sıfırdan uzağa
        self.assertEqual(m.ham_coz("10,5", "banka"), 1050)
        self.assertIsNone(m.ham_coz("-5", "banka"))
        self.assertIsNone(m.ham_coz("0", "modul"))
        self.assertIsNone(m.ham_coz("0,004", "modul"))           # yuvarlanınca sıfır
        self.assertIsNone(m.ham_coz("1e13", "banka"))
        self.assertIsNone(m.ham_coz("10000000000000", "banka"))  # 1e13 TL
        self.assertEqual(m.ham_coz("1000000000000", "banka"), 10 ** 14)
        self.assertEqual(m.ham_coz("-500", "banka", eksi_olur=True), -50000)
        self.assertEqual(m.ham_coz("0", "banka", sifir_olur=True), 0)

    def test_iban(self):
        self.assertTrue(m.iban_gecerli("TR880006200000006298765432"))
        self.assertFalse(m.iban_gecerli("TR880006200000006298765433"))
        self.assertFalse(m.iban_gecerli("TR88000620000000629876543"))

    def test_fis_dengesizligi_yakalanir(self):
        d = m.Durum(m.tarih_coz("08.10.2026"), {"Y": "yonetici"}, {})
        with self.assertRaises(m.KahinHatasi):
            d.fis_yaz("deneme", d.bugun, [("100", "B", 500, None), ("500", "A", 400, None)], 0)
        d.fis_yaz("deneme", d.bugun, [("100", "B", 500, None), ("500", "A", 500, None)], 0)


# ══════════════════════════════════════════════════════════════════════════════════ kabul 1–16

class Kabul116(unittest.TestCase):
    def setUp(self):
        with open(KABUL, encoding="utf-8") as f:
            self.sen = json.load(f)
        self.cikti = m.kos(self.sen, KABUL)

    def test_plan_sayilari_birebir(self):
        sayi, farklar = m.plan_karsilastir(self.cikti, self.sen)
        self.assertEqual(sayi, 28, "planBeklenen yaprak sayısı")
        self.assertEqual(farklar, [])

    def test_adim33_oncesi_mizan(self):
        c = self.cikti
        mizan_dengede(self, c)
        self.assertEqual(miz(c, "100"), {"borc": 1000000, "alacak": 0})
        self.assertEqual(miz(c, "102.01"), {"borc": 9000000, "alacak": 0})
        self.assertEqual(miz(c, "102.02"), {"borc": 7000000, "alacak": 0})
        self.assertEqual(miz(c, "120"), {"borc": 0, "alacak": 0})
        self.assertEqual(miz(c, "391"), {"borc": 0, "alacak": 333333})
        self.assertEqual(miz(c, "500"), {"borc": 0, "alacak": 15000000})
        self.assertEqual(miz(c, "600"), {"borc": 0, "alacak": 1666667})
        self.assertEqual(c["stok"], {"URA": 9, "URB": 25})
        self.assertEqual(c["ozet"]["kasaVeGercekBanka"], 17000000)
        self.assertEqual(c["retler"], [])
        self.assertEqual(c["belirsizler"], [])

    def test_cli_bayt_bayt_ayni(self):
        k1 = subprocess.run([sys.executable, "-I", MODEL, KABUL], capture_output=True)
        k2 = subprocess.run([sys.executable, "-I", MODEL, KABUL], capture_output=True)
        self.assertEqual(k1.returncode, 0, k1.stderr)
        self.assertEqual(k1.stdout, k2.stdout)
        cikti = json.loads(k1.stdout.decode("utf-8"))
        self.assertEqual(cikti["kaynak"], "kahin")
        self.assertEqual(m.plan_karsilastir(cikti, self.sen), (28, []))
        kayan = []

        def yuru(n, yol):
            if isinstance(n, float):
                kayan.append(yol)
            elif isinstance(n, dict):
                for k, v in n.items():
                    yuru(v, yol + "." + k)
            elif isinstance(n, list):
                for i, v in enumerate(n):
                    yuru(v, f"{yol}[{i}]")

        yuru(json.loads(k1.stdout.decode("utf-8"), parse_float=float), "")
        self.assertEqual(kayan, [], "çıktıda kayan noktalı sayı yok")


# ══════════════════════════════════════════════════════════════════════════ plan §3.7 kayıt akışları

class KayitAkislari(unittest.TestCase):
    def kabul_tabani(self):
        return [hesap("ZIR", "Ziraat Bankası"), hesap("GAR", "Garanti BBVA", bakiye="50000"), cari("ABC"),
                *urun("URA", 10),
                {"id": "f1", "islem": "fatura", "ad": "F1", "tur": "satis", "cari": "ABC",
                 "kalemler": [{"urun": "URA", "miktar": 1, "birimFiyat": "20000", "kdvOrani": 20, "kdvDahil": True}]},
                {"id": "th1", "islem": "cari_tahsilat", "ad": "TH1", "cari": "ABC", "tutar": "20000", "yol": "havale",
                 "hesap": "ZIR"},
                {"id": "kb1", "islem": "kasa_banka", "ad": "KB1", "yon": "bankadan_kasaya", "hesap": "ZIR",
                 "tutar": "10000"}]

    def test_ucretli_transfer_plan_3_7_11(self):
        # PLAN §3.7 #11: "Ücretli (EFT 5,00 + BSMV 0,25): B 102.02 20.000 · B 770 5,25 / A 102.01 20.005,25 →
        # Ziraat 89.994,75; Garanti 70.000"
        c = kos("t-ucretli", self.kabul_tabani() + [
            {"id": "tr1", "islem": "transfer", "ad": "TR1", "kaynak": "ZIR", "hedef": "GAR", "tutar": "20000",
             "ucret": "5", "ucretVergi": "bsmv_haric"}])
        self.assertEqual(c["bankaHesaplari"], {"ZIR": 8999475, "GAR": 7000000})
        self.assertEqual(miz(c, "770"), {"borc": 525, "alacak": 0})
        mizan_dengede(self, c)

    def test_ucretsiz_transfer_toplam_degismez(self):
        # Talimat 7: "Toplam işletme parası değişmemelidir"
        c = kos("t-ucretsiz", self.kabul_tabani() + [
            {"id": "tr1", "islem": "transfer", "ad": "TR1", "kaynak": "ZIR", "hedef": "GAR", "tutar": "20000",
             "ucret": "0"}])
        self.assertEqual(c["ozet"]["gercekBanka"], 16000000)
        self.assertNotIn("770", c["mizan"])

    def test_banka_fisleri_plan_3_7_12_18(self):
        # Hepsi 09.10.2026 Cuma. Ziraat 100.000 açılış.
        # #12 BSMV dahil 10,50 → 770 10,00 + 0,50; BSMV hariç 10,00 → 10,50 çıkar
        # #13 KDV dahil 120 → 770 100 · 191 20; banka −120; cari 0
        # #14 faiz 1.000 %15 → 102 850 · 193 150 / 642 1.000
        # #15 faiz gideri 250 → 780 ; #16 kart borcu 3.000 ; #17 kredi 20.000 kullan, 5.000 + 100 faiz öde
        # #18 diğer gelir 400 / diğer gider 300
        adimlar = [
            hesap("ZIR", "Ziraat Bankası"),
            hesap("KRT", "Ziraat Bankası", tur="kurumsal_kart", bakiye="0", kartLimiti="50000"),
            hesap("KRD", "Ziraat Bankası", tur="kredi", bakiye="0", dogru=False),
            cari("BNK", "tedarikci"), cari("TED", "tedarikci"),
            {"id": "m1", "islem": "banka_masraf", "ad": "M1", "hesap": "ZIR", "tutar": "10,50", "masrafTuru": "EFT",
             "vergi": "bsmv_dahil"},
            {"id": "m2", "islem": "banka_masraf", "ad": "M2", "hesap": "ZIR", "tutar": "10", "masrafTuru": "EFT",
             "vergi": "bsmv_haric"},
            {"id": "m3", "islem": "banka_masraf", "ad": "M3", "hesap": "ZIR", "tutar": "120", "masrafTuru": "Havale",
             "vergi": "kdv_dahil", "saglayici": "BNK", "fatura": "MF1"},
            {"id": "fg", "islem": "faiz_geliri", "ad": "FG", "hesap": "ZIR", "brut": "1000", "stopajOrani": "15"},
            {"id": "fd", "islem": "faiz_gideri", "ad": "FD", "hesap": "ZIR", "tutar": "250"},
            {"id": "to1", "islem": "cari_odeme", "ad": "TO1", "cari": "TED", "tutar": "3000", "yol": "kart",
             "hesap": "KRT"},
            {"id": "kbo", "islem": "kart_borcu_odeme", "ad": "KBO", "kaynak": "ZIR", "kart": "KRT", "tutar": "3000"},
            {"id": "kk", "islem": "kredi_kullanim", "ad": "KK", "kredi": "KRD", "hedef": "ZIR", "tutar": "20000"},
            {"id": "ko", "islem": "kredi_odeme", "ad": "KO", "kredi": "KRD", "kaynak": "ZIR", "anapara": "5000",
             "faiz": "100"},
            {"id": "dg", "islem": "diger_gelir", "ad": "DG", "hesap": "ZIR", "tutar": "400"},
            {"id": "dgg", "islem": "diger_gider", "ad": "DGG", "hesap": "ZIR", "tutar": "300"},
        ]
        c = kos("t-fisler", adimlar, bugun="09.10.2026")
        self.assertEqual(c["retler"], [])
        # ZIR = 10.000.000 − 1.050 − 1.050 − 12.000 + 85.000 − 25.000 − 300.000 + 2.000.000 − 510.000 + 40.000 − 30.000
        self.assertEqual(c["bankaHesaplari"]["ZIR"], 11245900)
        self.assertEqual(c["bankaHesaplari"]["KRT"], 0)
        self.assertEqual(c["bankaHesaplari"]["KRD"], -1500000)
        self.assertEqual(miz(c, "770"), {"borc": 1050 + 1050 + 10000, "alacak": 0})
        self.assertEqual(miz(c, "191"), {"borc": 2000, "alacak": 0})
        self.assertEqual(miz(c, "193"), {"borc": 15000, "alacak": 0})
        self.assertEqual(miz(c, "642"), {"borc": 0, "alacak": 100000})
        self.assertEqual(miz(c, "780"), {"borc": 35000, "alacak": 0})
        self.assertEqual(miz(c, "649"), {"borc": 0, "alacak": 40000})
        self.assertEqual(miz(c, "659"), {"borc": 30000, "alacak": 0})
        self.assertEqual(miz(c, "300.01"), {"borc": 0, "alacak": 1500000})
        self.assertEqual(c["cariler"], {"BNK": 0, "TED": 300000})
        self.assertEqual(c["faturalar"]["MF1"], {"toplam": 12000, "matrah": 10000, "kdv": 2000, "acik": 0})
        self.assertEqual(c["ozet"]["kartVeKrediBorcu"], 1500000)
        self.assertEqual(c["hesapKodlari"], {"ZIR": "102.01", "KRT": "309.01", "KRD": "300.01"})
        self.assertEqual(c["eksiBakiyeDenetimi"], {"ZIR": "uyar", "KRT": "uyar", "KRD": "kontrol_yok"})
        mizan_dengede(self, c)

    def test_kdv_haric_masraf(self):
        # KDV hariç 100, %20 → matrah 100, KDV 20, banka −120
        c = kos("t-kdvharic", [hesap("ZIR", "Ziraat"), cari("BNK", "tedarikci"),
                               {"id": "m", "islem": "banka_masraf", "ad": "M", "hesap": "ZIR", "tutar": "100",
                                "masrafTuru": "EFT", "vergi": "kdv_haric", "saglayici": "BNK", "fatura": "MF"}])
        self.assertEqual(c["faturalar"]["MF"], {"toplam": 12000, "matrah": 10000, "kdv": 2000, "acik": 0})
        self.assertEqual(c["bankaHesaplari"]["ZIR"], 10000000 - 12000)

    def test_taksit_talimat_11(self):
        # Talimat 11: "Taksit 10.000 … Banka: Garanti … Taksit: Ödendi · Cari: −10.000 · Banka: +10.000"
        taban = [hesap("ZIR", "Ziraat"), hesap("GAR", "Garanti", bakiye="50000"), cari("ABC"), *urun("URA", 10),
                 {"id": "f1", "islem": "fatura", "ad": "F1", "tur": "satis", "cari": "ABC",
                  "kalemler": [{"urun": "URA", "miktar": 1, "birimFiyat": "10000", "kdvOrani": 20, "kdvDahil": True}],
                  "odeme": {"taksit": {"ad": "T1", "sayi": 1}}},
                 {"id": "k1", "islem": "kontrol"},
                 {"id": "tt1", "islem": "taksit_tahsilat", "ad": "TT1", "kart": "T1", "tutar": "10000",
                  "yol": "havale", "hesap": "GAR"},
                 {"id": "k2", "islem": "kontrol"},
                 {"id": "sil", "islem": "sil", "hedef": "TT1"}]
        c = kos("t-taksit", taban)
        k1, k2 = c["araDurumlar"]["k1"], c["araDurumlar"]["k2"]
        self.assertEqual(k1["taksitKartlari"]["T1"], {"toplam": 1000000, "odenen": 0, "kalan": 1000000})
        self.assertEqual(k1["cariler"]["ABC"], 1000000)
        self.assertEqual(k1["faturalar"]["F1"]["acik"], 1000000)
        self.assertEqual(k2["taksitKartlari"]["T1"], {"toplam": 1000000, "odenen": 1000000, "kalan": 0})
        self.assertEqual(k2["cariler"]["ABC"], 0)
        self.assertEqual(k2["bankaHesaplari"]["GAR"], 6000000)
        self.assertEqual(k2["faturalar"]["F1"]["acik"], 0)
        # silinince geri döner
        self.assertEqual(c["taksitKartlari"]["T1"]["kalan"], 1000000)
        self.assertEqual(c["bankaHesaplari"]["GAR"], 5000000)
        mizan_dengede(self, c)

    def test_plan_mizani_600_610_391(self):
        # PLAN §12.5 adım 33 mizanının 600/610/391 satırları ödeme yolundan bağımsızdır: POS yerine havale ve
        # taksitle aynı belgeler → 600 = 35.000 · 610 = 2.500 · 391 = 6.500 · Ürün A 9 · Ürün B 6
        adimlar = [hesap("ZIR", "Ziraat"), hesap("GAR", "Garanti", bakiye="50000"), cari("ABC"),
                   *urun("URA", 10), *urun("URB", 25),
                   {"id": "f1", "islem": "fatura", "ad": "F1", "tur": "satis", "cari": "ABC",
                    "kalemler": [{"urun": "URA", "miktar": 1, "birimFiyat": "20000", "kdvOrani": 20,
                                  "kdvDahil": True}]},
                   {"id": "th1", "islem": "cari_tahsilat", "ad": "TH1", "cari": "ABC", "tutar": "20000",
                    "yol": "havale", "hesap": "ZIR", "kapatilacakFatura": "F1"},
                   {"id": "f2", "islem": "fatura", "ad": "F2", "tur": "satis", "cari": "ABC",
                    "kalemler": [{"urun": "URB", "miktar": 10, "birimFiyat": "1000", "kdvOrani": 20,
                                  "kdvDahil": True}],
                    "odeme": {"pesin": [{"yol": "havale", "tutar": "tamami", "hesap": "ZIR"}]}},
                   {"id": "f3", "islem": "fatura", "ad": "F3", "tur": "satis", "cari": "ABC",
                    "kalemler": [{"urun": "URB", "miktar": 12, "birimFiyat": "1000", "kdvOrani": 20,
                                  "kdvDahil": True}],
                    "odeme": {"taksit": {"ad": "T3", "sayi": 3}}},
                   {"id": "ia1", "islem": "iade", "ad": "IA1", "asilFatura": "F2",
                    "kalemler": [{"kalem": 1, "miktar": 3}], "geri": {"yol": "havale", "hesap": "ZIR"}}]
        c = kos("t-mizan33", adimlar)
        self.assertEqual(miz(c, "600"), {"borc": 0, "alacak": 3500000})
        self.assertEqual(miz(c, "610"), {"borc": 250000, "alacak": 0})
        self.assertEqual(miz(c, "391"), {"borc": 0, "alacak": 650000})
        self.assertEqual(c["stok"], {"URA": 9, "URB": 6})
        self.assertEqual(c["faturalar"]["F2"]["acik"], 0)
        self.assertEqual(c["faturalar"]["IA1"], {"toplam": 300000, "matrah": 250000, "kdv": 50000, "acik": 0})
        self.assertEqual(c["faturalar"]["F3"]["acik"], 1200000)
        self.assertEqual(c["taksitKartlari"]["T3"], {"toplam": 1200000, "odenen": 0, "kalan": 1200000})
        self.assertEqual(c["cariler"]["ABC"], 1200000)
        self.assertEqual(c["bankaHesaplari"]["ZIR"], 10000000 + 2000000 + 1000000 - 300000)
        self.assertEqual(c["belirsizler"], [])
        mizan_dengede(self, c)

    def test_ornek_masraf_senaryo_dili_14(self):
        # SENARYO-DILI §14: masraf 10,50 BSMV dahil, ters kayıt, ters kaydı iki kez → 409
        c = kos("ornek-masraf", [
            hesap("ZIR", "Ziraat Bankası", bakiye="1000"),
            {"id": "2", "islem": "banka_masraf", "ad": "M1", "hesap": "ZIR", "tutar": "10,50", "masrafTuru": "EFT",
             "vergi": "bsmv_dahil"},
            {"id": "3", "islem": "ters_kayit", "hedef": "M1"},
            {"id": "4", "islem": "ters_kayit", "hedef": "M1"}], bugun="09.10.2026")
        self.assertEqual(c["retler"], [{"adim": "4", "durum": 409, "kod": None, "kodDayanak": None}])
        self.assertEqual(miz(c, "102.01"), {"borc": 100000, "alacak": 0})
        self.assertEqual(miz(c, "500"), {"borc": 0, "alacak": 100000})
        self.assertEqual(miz(c, "770"), {"borc": 0, "alacak": 0})
        self.assertEqual(c["bankaHesaplari"], {"ZIR": 100000})


# ═════════════════════════════════════════════════════════════════════════════════ hesap seçimi (§5.2)

class HesapSecimi(unittest.TestCase):
    def test_hic_hesap_yok_102_00(self):
        c = kos("t-hs1", [cari("ABC"), {"id": "t", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "500",
                                         "yol": "havale"}])
        self.assertEqual(miz(c, "102.00"), {"borc": 50000, "alacak": 0})
        self.assertEqual(c["ozet"]["hesabiAtanmamis"], 50000)
        self.assertEqual(c["ozet"]["gercekBanka"], 0)

    def test_uygun_hesap_yokken_hesap_verilmesi(self):
        c = kos("t-hs2", [hesap("KRD", "X", tur="kredi", bakiye="0", dogru=False), cari("ABC"),
                          {"id": "t", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "500", "yol": "havale",
                           "hesap": "KRD"}])
        self.assertEqual(ret_of(c, "t"), {"adim": "t", "durum": 400, "kod": "bank-account-invalid",
                                          "kodDayanak": "CIKARIM"})

    def test_tek_hesap_kendiliginden(self):
        c = kos("t-hs3", [hesap("ZIR", "Z"), cari("ABC"),
                          {"id": "t", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "500", "yol": "havale"}])
        self.assertEqual(c["bankaHesaplari"]["ZIR"], 10050000)

    def test_cok_hesapta_zorunlu_pasif_vadeli(self):
        c = kos("t-hs4", [hesap("ZIR", "Z"), hesap("GAR", "G"), hesap("VAD", "V", tur="vadeli", bakiye="0"),
                          cari("ABC"),
                          {"id": "a", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "500", "yol": "havale"},
                          {"id": "b", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "500", "yol": "havale",
                           "hesap": "VAD"},
                          {"id": "p", "islem": "hesap_durum", "hesap": "ZIR", "durum": "pasif"},
                          {"id": "c", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "500", "yol": "havale",
                           "hesap": "ZIR"},
                          {"id": "d", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "500", "yol": "havale"}])
        self.assertEqual(ret_of(c, "a")["kod"], "bank-account-required")
        self.assertEqual(ret_of(c, "a")["kodDayanak"], "PLAN")
        self.assertEqual(ret_of(c, "b")["kod"], "bank-account-invalid")
        self.assertEqual(ret_of(c, "c")["kod"], "bank-account-invalid")
        self.assertIsNone(ret_of(c, "d"))                  # ZIR pasif → tek uygun GAR kendiliğinden
        self.assertEqual(c["bankaHesaplari"]["GAR"], 10050000)


# ═══════════════════════════════════════════════════════════════════════════════ eksi bakiye (§5.3)

class EksiBakiye(unittest.TestCase):
    def test_uyar_ve_yine_de_kaydet(self):
        c = kos("t-e1", [hesap("ZIR", "Z", bakiye="1000"), cari("TED", "tedarikci"),
                         {"id": "a", "islem": "cari_odeme", "cari": "TED", "tutar": "1500", "yol": "havale"},
                         {"id": "b", "islem": "cari_odeme", "cari": "TED", "tutar": "1500", "yol": "havale",
                          "yineDeKaydet": True}])
        self.assertEqual(ret_of(c, "a"), {"adim": "a", "durum": 409, "kod": "cash-negative", "kodDayanak": "CIKARIM"})
        self.assertIsNone(ret_of(c, "b"))
        self.assertEqual(c["bankaHesaplari"]["ZIR"], -50000)

    def test_engelle_gecilemez(self):
        c = kos("t-e2", [hesap("ZIR", "Z", bakiye="1000"), cari("TED", "tedarikci"),
                         {"id": "p", "islem": "hesap_eksi_politika", "hesap": "ZIR", "politika": "engelle"},
                         {"id": "a", "islem": "cari_odeme", "cari": "TED", "tutar": "1500", "yol": "havale",
                          "yineDeKaydet": True}])
        self.assertEqual(ret_of(c, "a"), {"adim": "a", "durum": 409, "kod": "cash-blocked", "kodDayanak": "PLAN"})
        self.assertEqual(c["eksiBakiyeDenetimi"]["ZIR"], "engelle")

    def test_dogrulanmamis_kontrol_yok(self):
        c = kos("t-e3", [hesap("ZIR", "Z", bakiye="1000", dogru=False), cari("TED", "tedarikci"),
                         {"id": "a", "islem": "cari_odeme", "cari": "TED", "tutar": "1500", "yol": "havale"}])
        self.assertEqual(c["retler"], [])
        self.assertEqual(c["eksiBakiyeDenetimi"]["ZIR"], "kontrol_yok")

    def test_kmh_limiti(self):
        # açılış −500, KMH 1.000: 400 öde → −900 + 1.000 ≥ 0 ; 200 daha → −1.100 + 1.000 < 0 → 409
        c = kos("t-e4", [hesap("ZIR", "Z", bakiye="-500", kmhLimiti="1000"), cari("TED", "tedarikci"),
                         {"id": "a", "islem": "cari_odeme", "cari": "TED", "tutar": "400", "yol": "havale"},
                         {"id": "b", "islem": "cari_odeme", "cari": "TED", "tutar": "200", "yol": "havale",
                          "benzerOnay": True}])
        self.assertIsNone(ret_of(c, "a"))
        self.assertEqual(ret_of(c, "b")["kod"], "cash-negative")
        self.assertEqual(miz(c, "102.01"), {"borc": 0, "alacak": 90000})
        self.assertEqual(miz(c, "500"), {"borc": 50000, "alacak": 0})

    def test_min_formulu_geriye_tarihli(self):
        # PLAN §3.9: "Bakiye = min(işlem günündeki bakiye, bütün hareketlerle bakiye) + KMH"
        # (a) 07.10'da 800 çıkış; 05.10 tarihli 500 çıkış: Bh(05.10) = 500 ama Bh(tüm) = −300 → ihlal
        # (b) 07.10'da 1.000 giriş; 05.10 tarihli 1.500 çıkış: Bh(tüm) = 500 ama Bh(05.10) = −500 → ihlal
        c = kos("t-mn", [hesap("ZIR", "Z", bakiye="1000"), hesap("GAR", "G", bakiye="1000"),
                         cari("TED", "tedarikci"), cari("ABC"),
                         {"id": "a1", "islem": "cari_odeme", "cari": "TED", "tutar": "800", "yol": "havale",
                          "hesap": "ZIR", "tarih": "07.10.2026"},
                         {"id": "a2", "islem": "cari_odeme", "cari": "TED", "tutar": "500", "yol": "havale",
                          "hesap": "ZIR", "tarih": "05.10.2026"},
                         {"id": "b1", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "1000", "yol": "havale",
                          "hesap": "GAR", "tarih": "07.10.2026"},
                         {"id": "b2", "islem": "cari_odeme", "cari": "TED", "tutar": "1500", "yol": "havale",
                          "hesap": "GAR", "tarih": "05.10.2026"}])
        self.assertEqual(ret_of(c, "a2")["kod"], "cash-negative")
        self.assertEqual(ret_of(c, "b2")["kod"], "cash-negative")
        self.assertEqual(c["bankaHesaplari"], {"ZIR": 20000, "GAR": 200000})

    def test_kasa(self):
        c = kos("t-e5", [{"id": "ka", "islem": "kasa_acilis", "tutar": "1000"},
                         {"id": "a", "islem": "kasa_hareket", "ad": "KH1", "yon": "cikis", "tutar": "300",
                          "aciklama": "Kırtasiye"},
                         {"id": "b", "islem": "kasa_hareket", "yon": "cikis", "tutar": "800", "aciklama": "Kira"},
                         {"id": "c", "islem": "kasa_hareket", "yon": "cikis", "tutar": "800", "aciklama": "Kira",
                          "yineDeKaydet": True}], ayarlar={"kasaEksiBakiye": "uyar"})
        self.assertEqual(ret_of(c, "b")["kod"], "cash-negative")
        self.assertEqual(c["kasa"], -10000)
        self.assertEqual(miz(c, "770"), {"borc": 110000, "alacak": 0})
        self.assertEqual(miz(c, "500"), {"borc": 0, "alacak": 100000})

    def test_esanli_iki_odeme_kabul_37(self):
        # PLAN §12.5 adım 37: Garanti 70.000 Engelle; iki muhasebeci aynı anda 40.000 + 40.000 → biri 200, öbürü
        # 409 cash-blocked; carileri farklı → Benzer İşlem yok.
        c = kos("t-e6", [hesap("GAR", "Garanti", bakiye="70000"), cari("XYZ", "tedarikci"), cari("KLM", "tedarikci"),
                         {"id": "p", "islem": "hesap_eksi_politika", "hesap": "GAR", "politika": "engelle"},
                         {"id": "o1", "islem": "cari_odeme", "kullanici": "M1", "cari": "XYZ", "tutar": "40000",
                          "yol": "havale", "hesap": "GAR", "ayniAnda": "a"},
                         {"id": "o2", "islem": "cari_odeme", "kullanici": "M2", "cari": "KLM", "tutar": "40000",
                          "yol": "havale", "hesap": "GAR", "ayniAnda": "a"}],
                 kullanicilar={"M1": "muhasebe", "M2": "muhasebe"})
        self.assertNotIn("mizan", c)
        alt = c["alternatifler"]
        self.assertEqual(len(alt), 2)
        reddedilen = sorted(a["retler"][0]["adim"] for a in alt)
        self.assertEqual(reddedilen, ["o1", "o2"])
        for a in alt:
            self.assertEqual(a["retler"][0]["kod"], "cash-blocked")
            self.assertEqual(a["bankaHesaplari"]["GAR"], 3000000)


# ═══════════════════════════════════════════════════════════════════════ istek kimliği ve Benzer İşlem

class Mukerrer(unittest.TestCase):
    def test_istek_kimligi(self):
        c = kos("t-ik", [hesap("ZIR", "Z"), cari("ABC"),
                         {"id": "a", "islem": "cari_tahsilat", "ad": "TH1", "cari": "ABC", "tutar": "1000",
                          "yol": "havale", "istekKimligi": "r1"},
                         {"id": "b", "islem": "cari_tahsilat", "ad": "TH2", "cari": "ABC", "tutar": "1000",
                          "yol": "havale", "istekKimligi": "r1"},
                         {"id": "c", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "2000", "yol": "havale",
                          "istekKimligi": "r1"},
                         {"id": "s", "islem": "sil", "hedef": "TH2"},
                         {"id": "s2", "islem": "sil", "hedef": "TH1"}])
        self.assertEqual(c["yinelenenler"], ["b"])
        self.assertEqual(ret_of(c, "c"), {"adim": "c", "durum": 409, "kod": None, "kodDayanak": None})
        # TH2 = TH1 (aynı hareket): silinince ikinci silme 404
        self.assertEqual(ret_of(c, "s2")["durum"], 404)
        self.assertEqual(c["bankaHesaplari"]["ZIR"], 10000000)

    def test_fatura_yinelemesi_taksit_adi_govdede_degil(self):
        # Aynı istek kimliği + aynı fatura gövdesi; yalnız senaryo takma adları (ad, taksit.ad) farklı → yineleme.
        # Yeni takma adlar aynı faturayı ve kartı anar; stok bir kez düşer.
        f = {"islem": "fatura", "tur": "satis", "cari": "ABC", "istekKimligi": "x",
             "kalemler": [{"urun": "URA", "miktar": 1, "birimFiyat": "100", "kdvOrani": 20, "kdvDahil": True}]}
        c = kos("t-fy", [cari("ABC"), *urun("URA", 5),
                         dict(f, id="b", ad="F1", odeme={"taksit": {"ad": "T1", "sayi": 2}}),
                         dict(f, id="b2", ad="F2", odeme={"taksit": {"ad": "T2", "sayi": 2}}),
                         {"id": "t", "islem": "taksit_tahsilat", "kart": "T2", "tutar": "40", "yol": "nakit"}])
        self.assertEqual(c["yinelenenler"], ["b2"])
        self.assertEqual(c["stok"]["URA"], 4)
        self.assertEqual(c["faturalar"]["F1"], c["faturalar"]["F2"])
        self.assertEqual(c["taksitKartlari"]["T1"], {"toplam": 10000, "odenen": 4000, "kalan": 6000})
        self.assertEqual(c["taksitKartlari"]["T2"], c["taksitKartlari"]["T1"])
        self.assertEqual(c["cariler"]["ABC"], 6000)

    def test_benzer_islem(self):
        c = kos("t-bz", [hesap("ZIR", "Z"), cari("ABC"),
                         {"id": "a", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "1000", "yol": "havale"},
                         {"id": "b", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "1000", "yol": "havale"},
                         {"id": "c", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "1000", "yol": "havale",
                          "benzerOnay": True},
                         {"id": "n1", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "1000", "yol": "nakit"},
                         {"id": "n2", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "1000", "yol": "nakit"},
                         {"id": "ay", "islem": "ayar", "benzerIslemUyarisi": "kapali"},
                         {"id": "d", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "1000", "yol": "havale"}])
        self.assertEqual(c["retler"], [{"adim": "b", "durum": 409, "kod": "bank-similar", "kodDayanak": "PLAN"}])
        self.assertEqual(c["bankaHesaplari"]["ZIR"], 10000000 + 3 * 100000)
        self.assertEqual(c["kasa"], 200000)


# ═══════════════════════════════════════════════════════════════════════════════════ yetki (§5.5)

class Yetki(unittest.TestCase):
    def test_personel_ve_muhasebe(self):
        c = kos("t-yt", [hesap("ZIR", "Z"), hesap("GAR", "G"), cari("ABC"), cari("TED", "tedarikci"),
                         {"id": "p1", "islem": "transfer", "kullanici": "P1", "kaynak": "ZIR", "hedef": "GAR",
                          "tutar": "100"},
                         {"id": "p2", "islem": "cari_tahsilat", "ad": "PH", "kullanici": "P1", "cari": "ABC",
                          "tutar": "100", "yol": "havale", "hesap": "ZIR"},
                         {"id": "p3", "islem": "sil", "kullanici": "P1", "hedef": "PH"},
                         {"id": "p4", "islem": "cari_tahsilat", "ad": "PN", "kullanici": "P1", "cari": "ABC",
                          "tutar": "50", "yol": "nakit"},
                         {"id": "p5", "islem": "sil", "kullanici": "P1", "hedef": "PN"},
                         {"id": "p6", "islem": "cari_odeme", "kullanici": "P1", "cari": "TED", "tutar": "10",
                          "yol": "havale", "hesap": "ZIR"},
                         {"id": "p7", "islem": "hesap_ac", "ad": "XX", "kullanici": "P1", "banka": "B",
                          "hesapAdi": "H", "tur": "vadesiz", "paraBirimi": "TRY", "acilisTarihi": "01.10.2026",
                          "acilisBakiyesi": "0"},
                         {"id": "m1", "islem": "transfer", "kullanici": "M1", "kaynak": "ZIR", "hedef": "GAR",
                          "tutar": "100"}],
                 kullanicilar={"P1": "personel", "M1": "muhasebe"}, ayarlar={"kasaEksiBakiye": "uyar"})
        for adim in ("p1", "p3", "p6", "p7"):
            self.assertEqual(ret_of(c, adim)["durum"], 403, adim)
        for adim in ("p2", "p4", "p5", "m1"):
            self.assertIsNone(ret_of(c, adim), adim)
        self.assertEqual(c["kasa"], 0)
        self.assertEqual(c["bankaHesaplari"], {"ZIR": 10000000 + 10000 - 10000, "GAR": 10000000 + 10000})
        self.assertEqual(c["atlananlar"], [])
        self.assertNotIn("XX", c["bankaHesaplari"])


# ═══════════════════════════════════════════════════════════════════════════ tarih, kilit, açılış

class TarihKilit(unittest.TestCase):
    def test_ileri_kilit_acilis_oncesi(self):
        c = kos("t-tk", [hesap("ZIR", "Z"), hesap("GAR", "G", acilis="07.10.2026"), cari("ABC"),
                         {"id": "i", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "1", "yol": "havale",
                          "hesap": "ZIR", "tarih": "09.10.2026"},
                         {"id": "k", "islem": "donem_kilidi", "kilitTarihi": "05.10.2026"},
                         {"id": "l", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "2", "yol": "havale",
                          "hesap": "ZIR", "tarih": "05.10.2026"},
                         {"id": "o", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "3", "yol": "havale",
                          "hesap": "ZIR", "tarih": "06.10.2026"},
                         {"id": "b", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "4", "yol": "havale",
                          "hesap": "GAR", "tarih": "06.10.2026"},
                         {"id": "g", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "5", "yol": "havale",
                          "hesap": "GAR", "tarih": "07.10.2026"}])
        self.assertEqual(ret_of(c, "i"), {"adim": "i", "durum": 400, "kod": None, "kodDayanak": None})
        self.assertEqual(ret_of(c, "l"), {"adim": "l", "durum": 409, "kod": "period-locked", "kodDayanak": "CIKARIM"})
        self.assertIsNone(ret_of(c, "o"))
        self.assertEqual(ret_of(c, "b"), {"adim": "b", "durum": "4xx", "kod": "bank-before-opening",
                                          "kodDayanak": "CIKARIM"})
        self.assertIsNone(ret_of(c, "g"))                   # açılış günü dahil
        self.assertEqual(c["cariler"]["ABC"], -800)

    def test_acilis_duzelt(self):
        c = kos("t-ad", [hesap("ZIR", "Z"), cari("ABC"),
                         {"id": "t", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "1000", "yol": "havale",
                          "tarih": "05.10.2026"},
                         {"id": "a1", "islem": "acilis_duzelt", "hesap": "ZIR", "acilisTarihi": "06.10.2026",
                          "acilisBakiyesi": "80000"},
                         {"id": "a2", "islem": "acilis_duzelt", "hesap": "ZIR", "acilisTarihi": "02.10.2026",
                          "acilisBakiyesi": "80000"},
                         # PLAN §3.8 "Yeni tarih hesaba bağlı ilk hareketten SONRA olamaz" → aynı gün izinli
                         {"id": "a3", "islem": "acilis_duzelt", "hesap": "ZIR", "acilisTarihi": "05.10.2026",
                          "acilisBakiyesi": "80000"}])
        self.assertEqual(ret_of(c, "a1"), {"adim": "a1", "durum": 409, "kod": "bank-opening-after-first",
                                           "kodDayanak": "PLAN"})
        self.assertIsNone(ret_of(c, "a2"))
        self.assertIsNone(ret_of(c, "a3"))
        self.assertEqual(miz(c, "102.01"), {"borc": 8100000, "alacak": 0})
        self.assertEqual(miz(c, "500"), {"borc": 0, "alacak": 8000000})

    def test_kilitli_fisin_ters_kaydi_bugun_tarihli(self):
        # PLAN §3.8: "Ters fiş tarihi: asıl fiş açık dönemdeyse aynı tarih, kilitliyse bugün"
        sen = senaryo("t-tl", [hesap("ZIR", "Z"),
                               {"id": "f", "islem": "faiz_geliri", "ad": "FG", "hesap": "ZIR", "brut": "100",
                                "stopajOrani": "0", "tarih": "06.10.2026"},
                               {"id": "k", "islem": "donem_kilidi", "kilitTarihi": "07.10.2026"},
                               {"id": "t", "islem": "ters_kayit", "hedef": "FG"}], bugun="09.10.2026")
        bugun, kul = m.senaryo_dogrula(sen, "t-tl.json")
        d = m.Durum(bugun, kul, {})
        for i, a in enumerate(sen["adimlar"]):
            d = m.adim_isle(d, a, i)
        self.assertEqual(d.retler, [])
        ters = [f for f in d.fisler if f["tur"] == "ters"]
        self.assertEqual(len(ters), 1)
        self.assertEqual(ters[0]["tarih"], m.tarih_coz("09.10.2026"))


# ═════════════════════════════════════════════════════════════════════════════════════ ters ve sil

class TersSil(unittest.TestCase):
    def test_ters_ve_sil_kurallari(self):
        c = kos("t-ts", [hesap("ZIR", "Z", bakiye="1000"), hesap("GAR", "G", bakiye="0"), cari("ABC"),
                         {"id": "fg", "islem": "faiz_geliri", "ad": "FG", "hesap": "ZIR", "brut": "100",
                          "stopajOrani": "0"},
                         {"id": "t1", "islem": "ters_kayit", "hedef": "FG"},
                         {"id": "t2", "islem": "ters_kayit", "hedef": "FG"},
                         {"id": "th", "islem": "cari_tahsilat", "ad": "TH1", "cari": "ABC", "tutar": "1000",
                          "yol": "havale", "hesap": "ZIR"},
                         {"id": "t3", "islem": "ters_kayit", "hedef": "TH1"},
                         {"id": "tr", "islem": "transfer", "ad": "TR", "kaynak": "ZIR", "hedef": "GAR",
                          "tutar": "500"},
                         {"id": "s0", "islem": "sil", "hedef": "TR"},
                         {"id": "s1", "islem": "sil", "hedef": "TH1"},
                         {"id": "s2", "islem": "sil", "hedef": "TH1"}])
        self.assertEqual(ret_of(c, "t2")["durum"], 409)
        self.assertEqual(ret_of(c, "t3")["durum"], "4xx")
        self.assertEqual(ret_of(c, "s0")["durum"], "4xx")
        self.assertEqual(ret_of(c, "s2")["durum"], 404)
        self.assertIsNone(ret_of(c, "s1"))
        self.assertEqual(miz(c, "642"), {"borc": 0, "alacak": 0})
        self.assertEqual(c["bankaHesaplari"], {"ZIR": 50000, "GAR": 50000})
        self.assertEqual(c["cariler"]["ABC"], 0)

    def test_silme_hesabi_eksiye_dusurur(self):
        # PLAN Aşama 0: "Kasa'yı eksiye düşüren silme → Uyar'da 409"
        c = kos("t-se", [cari("ABC"), cari("TED", "tedarikci"),
                         {"id": "a", "islem": "cari_tahsilat", "ad": "N1", "cari": "ABC", "tutar": "100",
                          "yol": "nakit"},
                         {"id": "b", "islem": "cari_odeme", "cari": "TED", "tutar": "80", "yol": "nakit"},
                         {"id": "s", "islem": "sil", "hedef": "N1"}], ayarlar={"kasaEksiBakiye": "uyar"})
        self.assertEqual(ret_of(c, "s")["kod"], "cash-negative")
        self.assertEqual(c["kasa"], 2000)


# ═══════════════════════════════════════════════════════════════════════════ fatura açığı (§7)

class FaturaAcigi(unittest.TestCase):
    def satis(self, ad, tarih, fiyat="1000", **ek):
        a = {"id": ad.lower(), "islem": "fatura", "ad": ad, "tur": "satis", "cari": "ABC", "tarih": tarih,
             "kalemler": [{"urun": "URA", "miktar": 1, "birimFiyat": fiyat, "kdvOrani": 20, "kdvDahil": True}]}
        a.update(ek)
        return a

    def test_fifo_en_eski_belge_tarihi(self):
        # FA (07.10) adımda önce, FB (06.10) sonra; bağsız 1.500 → önce FB (en eski tarih) kapanır
        c = kos("t-ff", [cari("ABC"), *urun("URA", 10), self.satis("FA", "07.10.2026"),
                         self.satis("FB", "06.10.2026"),
                         {"id": "t", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "1500", "yol": "nakit"}])
        self.assertEqual(c["faturalar"]["FB"]["acik"], 0)
        self.assertEqual(c["faturalar"]["FA"]["acik"], 50000)
        self.assertEqual(c["cariler"]["ABC"], 50000)

    def test_avans(self):
        c = kos("t-av", [cari("ABC"), *urun("URA", 10), self.satis("FA", "07.10.2026"),
                         {"id": "t", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "1500", "yol": "nakit"}])
        self.assertEqual(c["faturalar"]["FA"]["acik"], 0)
        self.assertEqual(c["cariler"]["ABC"], -50000)

    def test_iade_acik_ve_sinir(self):
        c = kos("t-ia", [cari("ABC"), *urun("URA", 10),
                         self.satis("F1", "07.10.2026", kalemler=[{"urun": "URA", "miktar": 2, "birimFiyat": "1000",
                                                                    "kdvOrani": 20, "kdvDahil": True}]),
                         {"id": "x", "islem": "iade", "ad": "IX", "asilFatura": "F1",
                          "kalemler": [{"kalem": 1, "miktar": 3}], "geri": {"yol": "acik"}},
                         {"id": "y", "islem": "iade", "ad": "IY", "asilFatura": "F1", "tarih": "06.10.2026",
                          "kalemler": [{"kalem": 1, "miktar": 1}], "geri": {"yol": "acik"}},
                         {"id": "z", "islem": "iade", "ad": "IZ", "asilFatura": "F1",
                          "kalemler": [{"kalem": 1, "miktar": 1}], "geri": {"yol": "acik"}}])
        self.assertEqual(ret_of(c, "x")["durum"], "4xx")
        self.assertEqual(ret_of(c, "y")["durum"], "4xx")
        self.assertEqual(c["faturalar"]["F1"]["acik"], 100000)
        self.assertEqual(c["faturalar"]["IZ"], {"toplam": 100000, "matrah": 83333, "kdv": 16667, "acik": 0})
        self.assertEqual(c["stok"]["URA"], 9)
        self.assertEqual(c["cariler"]["ABC"], 100000)
        self.assertEqual(miz(c, "610"), {"borc": 83333, "alacak": 0})

    def test_belirsiz_taksitli_ve_bagsiz(self):
        c = kos("t-bl", [cari("ABC"), *urun("URA", 10),
                         self.satis("F1", "07.10.2026", odeme={"taksit": {"ad": "T1", "sayi": 2}}),
                         {"id": "t", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "300", "yol": "nakit"},
                         {"id": "k", "islem": "kontrol"}])
        alanlar = {(b["alan"], b["neden"]) for b in c["belirsizler"]}
        self.assertIn(("faturalar.F1.acik", "BELİRSİZ-7"), alanlar)
        self.assertIn(("taksitKartlari.T1.kalan", "BELİRSİZ-7"), alanlar)
        self.assertIn(("araDurumlar.k.faturalar.F1.acik", "BELİRSİZ-7"), alanlar)
        self.assertEqual(c["cariler"]["ABC"], 70000)


# ═══════════════════════════════════════════════════════════════════════════════ ham tutar ve atlama

class HamVeAtlama(unittest.TestCase):
    def test_ham_tutarlar(self):
        c = kos("t-hm", [hesap("ZIR", "Z"), cari("ABC"),
                         {"id": "a", "islem": "cari_tahsilat", "cari": "ABC", "tutarHam": "1,005", "yol": "havale"},
                         {"id": "b", "islem": "banka_masraf", "hesap": "ZIR", "tutarHam": "10,005", "masrafTuru": "EFT",
                          "vergi": "yok"},
                         {"id": "c", "islem": "diger_gider", "hesap": "ZIR", "tutarHam": "-5"},
                         {"id": "d", "islem": "faiz_gideri", "hesap": "ZIR", "tutarHam": "10000000000000"}])
        self.assertEqual(c["cariler"]["ABC"], -101)
        for adim in ("b", "c", "d"):
            self.assertEqual(ret_of(c, adim)["durum"], 400, adim)

    def test_atlananlar(self):
        c = kos("t-at", [hesap("ZIR", "Z", acilis="09.10.2026"), cari("ABC"),
                         {"id": "t", "islem": "cari_tahsilat", "cari": "ABC", "tutar": "1", "yol": "havale",
                          "hesap": "ZIR"}])
        self.assertEqual(ret_of(c, "h-zir")["durum"], 400)
        self.assertEqual(c["atlananlar"], ["t"])
        self.assertEqual(c["bankaHesaplari"], {})


# ═══════════════════════════════════════════════════════════════════════════ geçersiz senaryolar

class GecersizSenaryo(unittest.TestCase):
    def gecersiz(self, sen, ad):
        with self.assertRaises(m.SenaryoHatasi):
            m.kos(sen, ad + ".json")

    def test_dil_ad_alan(self):
        s = senaryo("g1", [cari("ABC")])
        s["dil"] = "destekofis-senaryo/2"
        self.gecersiz(s, "g1")
        self.gecersiz(senaryo("g2", [cari("ABC")]), "baska-ad")
        self.gecersiz(senaryo("g3", [cari("ABC"), cari("ABC")]), "g3")                 # takma ad iki kez (id de)
        a = cari("ABC")
        a["bilinmeyen"] = 1
        self.gecersiz(senaryo("g4", [a]), "g4")
        self.gecersiz(senaryo("g5", [{"id": "t", "islem": "cari_tahsilat", "cari": "YOK", "tutar": "1",
                                      "yol": "nakit"}]), "g5")
        self.gecersiz(senaryo("g6", [cari("ABC"), {"id": "t", "islem": "cari_tahsilat", "cari": "ABC",
                                                   "tutar": "1.234,56", "yol": "nakit"}]), "g6")

    def test_belirsiz_kurallari(self):
        # BELİRSİZ-18: muhasebe Kasa↔Banka
        self.gecersiz(senaryo("g7", [hesap("ZIR", "Z"), {"id": "k", "islem": "kasa_banka", "kullanici": "M1",
                                                         "yon": "bankadan_kasaya", "tutar": "1"}],
                              kullanicilar={"M1": "muhasebe"}), "g7")
        # BELİRSİZ-2: kredi hesabı doğrulanmış açılamaz
        self.gecersiz(senaryo("g8", [hesap("KRD", "K", tur="kredi", bakiye="0", dogru=True)]), "g8")
        # BELİRSİZ-1: Kasa'dan çıkış var, kasaEksiBakiye yok
        self.gecersiz(senaryo("g9", [{"id": "k", "islem": "kasa_hareket", "yon": "cikis", "tutar": "1",
                                      "aciklama": "x"}]), "g9")
        # BELİRSİZ-14: stok eksiye düşmez
        self.gecersiz(senaryo("g10", [cari("ABC"), *urun("URA", 1),
                                      {"id": "f", "islem": "fatura", "ad": "F1", "tur": "satis", "cari": "ABC",
                                       "kalemler": [{"urun": "URA", "miktar": 2, "birimFiyat": "1", "kdvOrani": 20,
                                                     "kdvDahil": True}]}]), "g10")

    def test_cli_cikis_kodu_2(self):
        with tempfile.TemporaryDirectory() as td:
            yol = os.path.join(td, "bozuk.json")
            with open(yol, "w", encoding="utf-8") as f:
                json.dump(senaryo("baska", [cari("ABC")]), f)
            k = subprocess.run([sys.executable, "-I", MODEL, yol], capture_output=True)
            self.assertEqual(k.returncode, 2)
            self.assertEqual(k.stdout, b"")
            self.assertIn("senaryo-gecersiz", k.stderr.decode("utf-8"))


if __name__ == "__main__":
    unittest.main()
