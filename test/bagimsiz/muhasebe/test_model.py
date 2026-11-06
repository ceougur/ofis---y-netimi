#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Muhasebe kâhin modelinin kendi testleri (python3 test/bagimsiz/muhasebe/test_model.py).

Beklenen değerler kural kitabından ELLE yazıldı (senaryolar_elle.py "elle" bölümleri ve aşağıdaki birim testleri; hesabın kendisi yorum
satırlarında); programdan ya da onun testlerinden alınmadı. mutasyon.py bu testleri bilerek bozulmuş modele karşı koşar (testin dişi).
Dosyalar sınıfı (diskteki senaryo / beklenen dosyalarının güncelliği) mutasyonda koşmaz.
"""

import copy
import os
import sys
import unittest
from fractions import Fraction

BURASI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BURASI)
import model as M  # noqa: E402
import senaryolar_elle as E  # noqa: E402
import uretici as U  # noqa: E402
import uret_beklenen as UB  # noqa: E402

KOK = ("redler", "acilis_olabilir", "degismezler", "devirler")


def yol_al(sonuc, yol, beklenen):
    p = yol.split("/")
    x = sonuc if p[0] in KOK else sonuc["raporlar"]
    for i, seg in enumerate(p):
        if isinstance(x, list):
            x = x[int(seg)]
        elif seg in x:
            x = x[seg]
        elif beklenen == 0 and p[0] not in KOK:
            return 0                                    # sıfır bakiyeli satır / kalem raporda yer almaz
        else:
            raise KeyError(f"{yol}: '{seg}' yok")
    if p == ["redler"]:
        return [r["kod"] for r in x]
    return x


def senaryo(olaylar, **ek):
    s = {"olaylar": olaylar}
    s.update(copy.deepcopy(E.TANIM))
    s.update(ek)
    return s


def o(tur, tarih=None, **kw):
    return E.o(tur, tarih, **kw)


def yevmiye(olaylar, kurallar=None, **ek):
    r = M.kos(senaryo(olaylar + [E.R("yev", "yevmiye")], **ek), kurallar)
    return r["raporlar"]["yev"], r


def satirlar(m):
    """Maddeyi {hesap|cari: borç − alacak} sözlüğüne çevirir."""
    out = {}
    for s in m["satirlar"]:
        k = M.anahtar(s["h"], s.get("c"))
        out[k] = out.get(k, 0) + s.get("b", 0) - s.get("a", 0)
    return out


# ------------------------------------------------------------------------------------------------ yardımcılar
class Yardimci(unittest.TestCase):
    def test_yuvarla_yarim_yukari_G1(self):
        self.assertEqual([M.yuvarla(Fraction(x, 2)) for x in (1, 3, 5, -1, -3)], [1, 2, 3, -1, -2])
        self.assertEqual(M.yuvarla(Fraction(999 * 20, 120)), 167)       # 166,5 → 167 (bankacı yuvarlaması 166 verirdi)
        self.assertEqual(M.yuvarla(Fraction(20000, 3)), 6667)

    def test_tarih_29_subat_yil_donumu(self):
        self.assertEqual(M.ay_sonu("2028-02"), "2028-02-29")
        self.assertEqual(M.ay_sonu("2026-02"), "2026-02-28")
        self.assertEqual(M.ay_sonu("2026-12"), "2026-12-31")
        self.assertEqual(M.ertesi("2028-02-29"), "2028-03-01")
        self.assertEqual(M.ertesi("2026-12-31"), "2027-01-01")

    def test_acilis_aciklamasi_turkce_buyuk_harf(self):
        self.assertTrue(M.acilis_aciklamasi("AÇILIŞ"))
        self.assertTrue(M.acilis_aciklamasi("  Açılış bakiyesi"))
        self.assertFalse(M.acilis_aciklamasi("Devreden bakiye"))

    def test_kurallar_dallar(self):
        k = M.Kurallar()
        self.assertEqual({getattr(k, a) for a in M.IKI_DALLI}, {"A"})
        self.assertEqual(M.Kurallar.etiketten("KG6=B,KG3=KITAP").etiket(), "KG3=KITAP,KG6=B")
        with self.assertRaises(ValueError):
            M.Kurallar(KG3="SORU")                       # eski etiket: KG-3 onaylanan metin artık A
        with self.assertRaises(ValueError):
            M.Kurallar(KG6="C")

    def test_dengesiz_madde_reddi_G6(self):
        with self.assertRaises(AssertionError):
            M.madde_kur("x", "2026-01-01", 1, 1, "x", "t", [M.Bo("100", 5), M.Al("600", 4)])

    def test_hesap_plani_her_hesap_kalemde_C1(self):
        for kod, (ad, tur, kalem) in M.HESAPLAR.items():
            if tur in ("KP", "MAL") and kalem is None:
                continue
            self.assertIsNotNone(kalem, kod)
            if kod[0] in "12345":
                self.assertIn(kalem, M.BILANCO_KALEMLERI, kod)
            else:
                self.assertIn(kalem, M.GT_SIRA, kod)


# ------------------------------------------------------------------------------------------------ olay → madde (kural kitabı §3)
class OlayMaddeleri(unittest.TestCase):
    def test_F01_satis(self):
        yev, _ = yevmiye([o("satis_faturasi", "2026-03-10", id="F1", cari="C1", M=100000, K=20000)])
        self.assertEqual(satirlar(yev[0]), {"120|C1": 120000, "600": -100000, "391": -20000})
        self.assertEqual(yev[0]["sinif"], 1)

    def test_F05_tevkifatli_alis_191_tamami(self):
        yev, _ = yevmiye([o("alis_faturasi", "2026-02-10", cari="T1", M=200000, K=40000, T=20000, kalemler=[{"urun": "U1", "miktar": 2}])])
        self.assertEqual(satirlar(yev[0]), {"153": 200000, "191": 40000, "320|T1": -220000, "360": -20000})

    def test_F06_kira_stopaji(self):
        yev, _ = yevmiye([o("alis_faturasi", "2026-05-02", cari="T2", fatura_turu="gider", gider_turu="genel", M=1000000, S=200000)])
        self.assertEqual(satirlar(yev[0]), {"770": 1000000, "320|T2": -800000, "360": -200000})

    def test_F06_M14_gider_turu_esleme(self):
        # EK-1 M14: satış 760, genel 770, finansman 780, demirbaş 255, ceza 689; bakım 2 — EK-2 38 / E17: boş → 770 (varsayılan),
        # eşlemede olmayan değer → 770.90 (G-8). Eski beklenti: boş → 770.90.
        tur = [("satis", "760"), ("genel", "770"), ("finansman", "780"), ("demirbas", "255"), ("ceza", "689"), (None, "770"),
               ("bilinmeyen", "770.90")]
        ols = [o("alis_faturasi", "2026-05-02", cari="T1", fatura_turu="gider", M=100, **({"gider_turu": g} if g else {})) for g, _ in tur]
        yev, _ = yevmiye(ols)
        self.assertEqual([[h for h in satirlar(m) if h[0] in "267"] for m in yev], [[h] for _, h in tur])

    def test_F10_esmm_stopaj_193(self):
        yev, _ = yevmiye([o("esmm", "2026-06-01", cari="C1", brut=1000000, K=200000, S=200000)])
        self.assertEqual(satirlar(yev[0]), {"120|C1": 1000000, "193": 200000, "600": -1000000, "391": -200000})

    def test_T03_pos_komisyon_KG6(self):
        ols = [o("tahsilat", "2026-08-10", cari="C1", yol="pos", pos="POS1", tutar=100000, komisyon=2500, valor="2026-08-12")]
        yev, _ = yevmiye(ols)
        self.assertEqual([(m["tarih"], satirlar(m)) for m in yev],
                         [("2026-08-10", {"108.POS1": 100000, "120|C1": -100000}), ("2026-08-10", {"653": 2500, "108.POS1": -2500}),
                          ("2026-08-12", {"102.B1": 97500, "108.POS1": -97500})])
        yev, _ = yevmiye(ols, M.Kurallar(KG6="B"))
        self.assertEqual(satirlar(yev[-1]), {"102.B1": 97500, "653": 2500, "108.POS1": -100000})
        self.assertEqual(yev[-1]["tarih"], "2026-08-12")

    def test_V01_mahsup_net_eksi_190_ve_360(self):
        # D 6000, İ 0, H 20000 → B 391 20000 / A 190 6000, A 360 14000
        yev, _ = yevmiye([o("alis_faturasi", "2026-03-01", cari="T1", fatura_turu="gider", M=30000, K=6000), o("kdv_mahsup", ay="2026-03"),
                          o("satis_faturasi", "2026-04-10", cari="C1", M=100000, K=20000), o("kdv_mahsup", ay="2026-04")])
        m = [x for x in yev if x["tur"] == "kdv_mahsup"]
        self.assertEqual(satirlar(m[0]), {"190": 6000, "191": -6000})
        self.assertEqual(satirlar(m[1]), {"391": 20000, "190": -6000, "360": -14000})
        self.assertEqual((m[1]["tarih"], m[1]["sinif"]), ("2026-04-30", 2))

    def test_M01_M08_M09_acilis_karsisi_519(self):
        yev, _ = yevmiye([o("kasa_acilis", "2026-01-01", tutar=1000),
                          o("evrak_acilis", "2026-01-01", evrak="E1", evrak_turu="cek", yon="alinan", tutar=300, cari="C1"),
                          o("evrak_acilis", "2026-01-01", evrak="E2", evrak_turu="senet", yon="verilen", tutar=200, cari="T1")])
        self.assertEqual([satirlar(m) for m in yev], [{"100": 1000, "519": -1000}, {"101.01": 300, "519": -300}, {"519": 200, "321": -200}])
        self.assertTrue(all(m["sinif"] == 0 for m in yev))

    def test_C01_C02_borc_alacak_yaz_90(self):
        yev, _ = yevmiye([o("borc_yaz", "2026-01-05", cari="C1", tutar=500, aciklama="Fark"),
                          o("alacak_yaz", "2026-01-06", cari="C1", tutar=100, aciklama="İndirim")])
        self.assertEqual([satirlar(m) for m in yev], [{"120|C1": 500, "602.90": -500}, {"770.90": 100, "120|C1": -100}])

    def test_K02_K14_K07(self):
        yev, _ = yevmiye([o("kasa_cikis", "2026-01-07", tutar=50), o("hesapsiz_hareket", "2026-01-10", cari="C1", yon="odeme", tutar=70),
                          o("banka_transfer", "2026-02-27", gonderen="B1", alici="B2", tutar=500, valor="2026-03-02")])
        self.assertEqual([satirlar(m) for m in yev], [{"770.90": 50, "100": -50}, {"120|C1": 70, "519": -70},
                                                     {"108.90": 500, "102.B1": -500}, {"102.B2": 500, "108.90": -500}])

    def test_J04_karsilik_cozulmesi(self):
        yev, _ = yevmiye([o("satis_faturasi", "2026-01-10", cari="C1", M=1000), o("supheliye_al", "2026-02-01", id="S1", cari="C1", tutar=800),
                          o("karsilik_ayir", "2026-02-02", cari="C1", tutar=600, kayit="S1"),
                          o("tahsilat", "2026-03-01", cari="C1", yol="nakit", tutar=300, supheliden=True)])
        self.assertEqual(satirlar(yev[-1]), {"129|C1": 100, "644": -100})

    def test_S03_belgesiz_satis_KG2(self):
        yev, _ = yevmiye([o("stok_cikis_satis", "2026-01-10", urun="U1", miktar=1, tutar=1200, karsi="nakit")])
        self.assertEqual(satirlar(yev[0]), {"100": 1200, "600.90": -1200})
        yev, _ = yevmiye([o("stok_cikis_satis", "2026-01-10", urun="U1", miktar=1, tutar=1200, karsi="nakit")], M.Kurallar(KG2="B"))
        self.assertEqual(satirlar(yev[0]), {"100": 1200, "600.90": -1000, "391": -200})

    def test_H03_taksit_yeni_borc_ve_KG5(self):
        yev, _ = yevmiye([o("taksit_karti", "2026-03-01", id="TK1", cari="C1", kaynak="yeni_borc", toplam=900,
                            taksitler=[{"vade": "2026-04-01", "tutar": 900}]),
                          o("taksit_excel", "2026-03-01", id="TE1", cari="C2", toplam=1000, odenen=300)])
        self.assertEqual([satirlar(m) for m in yev], [{"120|C2": 700, "519": -700}, {"120|C1": 900, "600.90": -900}])

    def test_N_kapanis_sirasi_ve_siniflari(self):
        ols = [o("alis_faturasi", "2026-02-01", cari="T1", M=1000, kalemler=[{"urun": "U1", "miktar": 10}]),
               o("satis_faturasi", "2026-03-01", cari="C1", M=900, kalemler=[{"urun": "U1", "miktar": 6}]),
               o("kasa_cikis", "2026-03-02", tutar=10), o("kasa_giris", "2026-03-01", tutar=100),
               o("devir", K="2026-12-31"), E.R("yev", "yevmiye", dosya="arsiv", bas="2026-12-31", son="2026-12-31")]
        r = M.kos(senaryo(ols))
        yev = r["raporlar"]["yev"]
        adim = [(m["sinif"], m["tur"], sorted(satirlar(m))) for m in yev]
        # N-01 (dönem sonu) → N-02 → N-03 → N-04 → N-06 → N-07; hepsi K tarihli
        self.assertEqual(adim[0], (2, "stok_degerleme", ["153", "621"]))
        self.assertEqual([a[0] for a in adim[1:]], [3, 3, 3, 3, 3])
        self.assertEqual(adim[1][2], ["632", "771"])
        self.assertEqual(adim[2][2], ["770.90", "771"])
        self.assertEqual(adim[3][2], ["600", "621", "632", "649.90", "690"])
        self.assertEqual(adim[4][2], ["690", "692"])
        self.assertEqual(adim[5][2], ["590", "692"])
        self.assertEqual(satirlar(yev[5])["590"], -(900 + 100 - 600 - 10))

    def test_N10_acik_kalem_karsiligi_519_gelir_degil(self):
        ols = [o("satis_faturasi", "2026-12-15", id="F1", cari="C1", M=1000, vade="2027-01-15"), o("devir", K="2026-12-31", ad="dv"),
               E.R("yev", "yevmiye", bas="2027-01-01", son="2027-01-01"), E.R("ak", "acik_kalemler", cari="C1", tarih="2027-01-01")]
        r = M.kos(senaryo(ols))
        self.assertEqual([satirlar(m) for m in r["raporlar"]["yev"]], [{"120|C1": 1000, "519": -1000}, {"590": -1000, "519": 1000}])
        # M3: defter satırında vade yok (tek net satır); açık kalem cari modülünde kendi vadesiyle (M2)
        self.assertEqual(r["raporlar"]["yev"][0]["satirlar"][0]["e"]["tur"], "devir_cari")
        self.assertEqual(r["raporlar"]["ak"], [{"k": "fatura:F1", "tur": "fatura", "kalan": 1000, "vade": "2027-01-15", "tarih": "2026-12-15"}])

    def test_KG7_indirim_donemi(self):
        # Aralık faturası, KDV indirimi Ocak'ta: Aralık mahsubuna girmez, Ocak'ınkine girer
        ols = [o("satis_faturasi", "2026-12-01", cari="C1", M=10000, K=2000),
               o("alis_faturasi", "2026-12-28", cari="T1", fatura_turu="gider", M=5000, K=1000, indirim_ayi="2027-01"),
               o("kdv_mahsup", ay="2026-12"), o("kdv_mahsup", ay="2027-01"), E.R("yev", "yevmiye")]
        r = M.kos(senaryo(ols))
        m = [x for x in r["raporlar"]["yev"] if x["tur"] == "kdv_mahsup"]
        self.assertEqual(satirlar(m[0]), {"391": 2000, "360": -2000})
        self.assertEqual(satirlar(m[1]), {"190": 1000, "191": -1000})
        r = M.kos(senaryo(ols), M.Kurallar(KG7="B"))
        m = [x for x in r["raporlar"]["yev"] if x["tur"] == "kdv_mahsup"]
        self.assertEqual(satirlar(m[0]), {"391": 2000, "191": -1000, "360": -1000})
        self.assertEqual([x["kod"] for x in r["redler"]], ["KDV_MAHSUP_BOS"])

    def test_D02_komisyon_faturasi_kdv(self):
        yev, _ = yevmiye([o("pos_komisyon_faturasi", "2026-08-31", K=500),
                          o("pos_komisyon_faturasi", "2026-08-31", K=300, karsi="cari", cari="T1")])
        self.assertEqual([satirlar(m) for m in yev], [{"191": 500, "653": -500}, {"191": 300, "320|T1": -300}])

    def test_C03_C12_evrak_bankadan_geri_al_ve_islem_geri_al(self):
        ols = [o("tahsilat", "2026-09-02", cari="C1", yol="cek", evrak="CK1", tutar=1000),
               o("evrak_tahsile_ver", "2026-09-05", evrak="CK1", banka="B1"),
               o("evrak_bankadan_geri_al", "2026-09-06", evrak="CK1")]
        yev, _ = yevmiye(ols)
        self.assertEqual([satirlar(m) for m in yev[1:]], [{"101.02": 1000, "101.01": -1000}, {"101.01": 1000, "101.02": -1000}])
        yev, r = yevmiye(ols[:2] + [o("evrak_islem_geri_al", evrak="CK1")])
        self.assertEqual([satirlar(m) for m in yev], [{"101.01": 1000, "120|C1": -1000}])   # tahsile verme maddesi yok sayıldı
        self.assertEqual(r["redler"], [])

    def test_H02_H05_H07_taksit_maddesiz_ve_iade(self):
        ols = [o("borc_yaz", "2026-01-05", cari="C1", tutar=900, aciklama="Eski borç"),
               o("taksit_karti", "2026-01-06", id="TK1", cari="C1", kaynak="mevcut_borc", toplam=900,
                 taksitler=[{"vade": "2026-02-01", "tutar": 900}]),
               o("tahsilat", "2026-02-01", cari="C1", yol="nakit", tutar=900, taksit_karti="TK1"),
               o("odeme", "2026-02-02", cari="C1", yol="nakit", tutar=100, taksit_karti="TK1"),
               o("taksit_kapat", "2026-02-03", kart="TK1")]
        yev, r = yevmiye(ols)
        self.assertEqual([satirlar(m) for m in yev], [{"120|C1": 900, "602.90": -900}, {"100": 900, "120|C1": -900},
                                                     {"120|C1": 100, "100": -100}])
        self.assertTrue(M.tumu_tuttu(r["degismezler"]))

    def test_TYK_bag_hedefin_bagsiz_kapanisini_geri_alir(self):
        # EK-1 §1 adım 3 "bağlar önce" (README KARAR GEREKİYOR 24; mutasyon N25 için sonradan elle yazıldı): F1 bağsız P1 ile kapanmışken
        # P2 "Kapatılacak Fatura: F1" gelir → P2 F1'i kapatır, P1 serbest kalır ve avans olarak açık kalır (P2 değil)
        r = M.kos(senaryo([o("satis_faturasi", "2026-03-01", id="F1", cari="C1", M=10000, vade="2026-03-31"),
                           o("tahsilat", "2026-03-10", id="P1", cari="C1", yol="nakit", tutar=10000),
                           o("tahsilat", "2026-03-20", id="P2", cari="C1", yol="nakit", tutar=10000, fatura="F1"),
                           E.R("ak", "acik_kalemler", cari="C1", tarih="2026-03-31")]))
        self.assertEqual(r["raporlar"]["ak"], [{"k": "tahsilat:P1", "tur": "tahsilat", "kalan": -10000, "vade": "2026-03-10", "tarih": "2026-03-10"}])

    def test_K3_kabul_E_iki_kayit_en_eskisi_once(self):
        # docs/2.3.0-SUPHELI-KABUL.md §2 E (plandan elle): al 2.000 (03.10), al 3.000 (04.10) → tahsilat 2.500 (05.10)
        # → kayıt 1 kalan 0, kayıt 2 kalan 2.500; 128 = 2.500
        r = M.kos(senaryo([o("borc_yaz", "2026-10-01", cari="C1", tutar=1000000, aciklama="Bedel"),
                           o("supheliye_al", "2026-10-03", id="S1", cari="C1", tutar=200000),
                           o("supheliye_al", "2026-10-04", id="S2", cari="C1", tutar=300000),
                           o("tahsilat", "2026-10-05", cari="C1", yol="nakit", tutar=250000),
                           E.R("k", "supheli_kayitlari", cari="C1"), E.MZ("mz", "2026-10-01", "2026-10-31")]))
        self.assertEqual([(x["id"], x["kalan"]) for x in r["raporlar"]["k"]], [("S1", 0), ("S2", 250000)])
        self.assertEqual(r["raporlar"]["mz"]["satirlar"]["128|C1"]["bakiye"], 250000)

    # ---- kâhin bakımı 2 (beklenenler model değiştirilmeden ÖNCE elle yazıldı; README R1…R21)
    def test_R1_sonradan_dogan_borc_dagitimi_degistirmez(self):
        # karar (1) + EK-2 §4 (2): 01.04'teki bağsız ödeme o gün açık tek borç F1'i (vade 30.06) kapatır; sonra (10.05) gelen vadesiz
        # Borç Yaz ödemeyi kendine çekmez → F1 kapalı kalır, BY 10000 açık (eski dağıtım değişmez)
        ols = [o("satis_faturasi", "2026-03-01", id="F1", cari="C1", M=10000, vade="2026-06-30"),
               o("tahsilat", "2026-04-01", cari="C1", yol="nakit", tutar=10000)]
        r0 = M.kos(senaryo(ols + [E.R("ak", "acik_kalemler", cari="C1", tarih="2026-05-31")]))
        r1 = M.kos(senaryo(ols + [o("borc_yaz", "2026-05-10", id="BY", cari="C1", tutar=10000, aciklama="Fark"),
                                  E.R("ak", "acik_kalemler", cari="C1", tarih="2026-05-31"),
                                  E.R("g", "gecikmis", cari="C1", tarih="2026-05-31")]))
        self.assertEqual(r0["raporlar"]["ak"], [])
        self.assertEqual(r1["raporlar"]["ak"], [{"k": "borc:BY", "tur": "borc_yaz", "kalan": 10000, "vade": "2026-05-10", "tarih": "2026-05-10"}])
        self.assertEqual(r1["raporlar"]["g"]["gecikmis"], 10000)

    def test_N06_691_692ye_kapanir(self):
        # EK-2 40 / kitap N-06: 691 690'a değil 692'ye kapanır (692 = 690 − 691); 691 verisi elle (KG-13 A'da program yazmaz)
        m = M.Model(senaryo([o("satis_faturasi", "2026-05-01", cari="C1", M=5000)]))
        m.kos()
        m.canli.fis_ekle("2026-12-31", 1, "vergi_karsiligi", [M.Bo("691", 1000), M.Al("370", 1000)])
        m.devir({"K": "2026-12-31"})
        a = m.arsivler[0]
        bal = a.bakiyeler("2026-12-31")
        self.assertEqual([bal.get((h, None), 0) for h in ("690", "691", "692", "590")], [0, 0, 0, -4000])
        n4 = next(f for f in a.fisler if f.ek.get("adim") == "N-04")
        self.assertNotIn("691", [s["h"] for s in n4.satirlar])
        n6 = next(f for f in a.fisler if f.ek.get("adim") == "N-06")
        self.assertEqual(sorted((s["h"], s["b"] - s["a"]) for s in n6.satirlar), [("690", 5000), ("691", -1000), ("692", -5000), ("692", 1000)])
        self.assertEqual(m.devirler[0]["kapanis"]["sonuc"], 4000)
        self.assertTrue(M.tumu_tuttu(m.devirler[0]["degismezler"]), m.devirler[0]["degismezler"])

    def test_R18_R16_hesap_adlari(self):
        # EK-2 39 / E15: hesap adı "(Geçici)" eksiz; Bilanço satırında "(Geçici)". EK-2 36 / E14: 127 Diğer Ticari Alacaklar, I.C, ters → III.D
        self.assertEqual(M.HESAPLAR["519"][0], "Eşleştirilecek Açılış Bakiyeleri")
        self.assertEqual(M.BILANCO_KALEMLERI["V.G"], "Eşleştirilecek Açılış Bakiyeleri (Geçici)")
        self.assertEqual(M.HESAPLAR["127"], ("Diğer Ticari Alacaklar", "A", "I.C"))
        self.assertEqual(M.TERS["127"], "III.D")

    def test_R14_kayitsiz_supheli_islemi_senaryo_hatasi(self):
        # EK-2 31: Karşılık Ayır / Değersiz Alacak Yaz / Şüpheliden Çıkar kayıt başına; olay dili kaydı taşır, kayıtsız varsayılan yok
        bas = [o("satis_faturasi", "2026-01-10", cari="C1", M=1000), o("supheliye_al", "2026-02-01", id="S1", cari="C1", tutar=800)]
        for x in (o("karsilik_ayir", "2026-02-02", cari="C1", tutar=100), o("degersiz_yaz", "2026-02-02", cari="C1"),
                  o("supheliden_cikar", "2026-02-02", cari="C1")):
            with self.assertRaises(AssertionError, msg=x["tur"]):
                M.kos(senaryo(bas + [x, E.MZ("mz", "2026-01-01", "2026-12-31")]))
        r = M.kos(senaryo(bas + [o("karsilik_ayir", "2026-02-02", cari="C1", tutar=100, kayit="S1"),
                                 o("degersiz_yaz", "2026-02-03", cari="C1", kayit="YOK")]))
        self.assertEqual([x["kod"] for x in r["redler"]], ["SUPHELI_YOK"])

    # ---- kâhin bakımı 3 (beklenenler model değiştirilmeden ÖNCE elle yazıldı; README T1…T13)
    def test_S11_avans_kahin_susar(self):
        # T8 (a) / KULLANICIYA SORULMALI 1: çek kilitli dönemde alındı ama o gün açık borç yoktu (L'de 10000 avans); kilitten sonra F1'i kapattı;
        # karşılıksız kilitten sonra → iki okuma, kâhin kural SAYMAZ: kahin_susuyor [("S11_AVANS", L'deki dağılmamış tutar 10000)].
        # Tamamen dağılmış evrakta (s63) susmaz.
        r = M.kos(senaryo([o("tahsilat", "2026-11-10", id="P1", cari="C1", yol="cek", evrak="CK1", tutar=10000),
                           o("donem_kilitle", tarih="2026-12-31"),
                           o("satis_faturasi", "2027-01-05", id="F1", cari="C1", M=10000, K=0, vade="2027-03-31"),
                           o("evrak_karsiliksiz", "2027-01-10", evrak="CK1"),
                           E.R("g", "gecikmis", cari="C1", tarih="2027-01-11")]))
        self.assertEqual([(x["neden"], x.get("tutar")) for x in r["raporlar"]["g"].get("kahin_susuyor", [])], [("S11_AVANS", 10000)])

    def test_EK2_4_1_ayni_gun_yazim_sirasi_sonucu_degistirmez(self):
        # EK-2 §4 (1) (karar (1) ile): aynı gündeki kalemlerin yazım sırası ters çevrilince her carinin gecikmişi ve vade bazında açık
        # borç / alacak toplamları aynı (ders 31)
        guvenli = {"satis_faturasi", "alis_faturasi", "borc_yaz", "alacak_yaz"}

        def guvenli_mi(x):
            return x["tur"] in guvenli or (x["tur"] in ("tahsilat", "odeme") and x.get("yol") in ("nakit", "havale"))

        def ters_cevir(ols):
            out, i = [], 0
            while i < len(ols):
                j = i
                while j < len(ols) and guvenli_mi(ols[j]) and ols[j].get("tarih") == ols[i].get("tarih"):
                    j += 1
                if j - i > 1:
                    out += list(reversed(ols[i:j]))
                    i = j
                else:
                    out.append(ols[i])
                    i += 1
            return out

        def ozet(sen):
            m = M.Model(sen)
            m.kos()
            d, out = m.canli, {}
            tarihler = sorted({x["tarih"] for x in sen["olaylar"] if "tarih" in x and x["tur"] != "rapor"})
            for c in sorted(sen["cariler"]):
                for t in tarihler + [M.ertesi(tarihler[-1])]:
                    q = d.kuyruk(c, t)
                    vade = {}
                    for x in q.acik_ogeler():
                        vade[(x["taraf"], x["vade"])] = vade.get((x["taraf"], x["vade"]), 0) + x["kalan"]
                    out[(c, t)] = (d.gecikmis(c, t)["gecikmis"], vade)
            return out
        denenen = 0
        for s in E.SENARYOLAR:
            x = dict(s, **E.TANIM)
            if any(o_["tur"] in ("devir", "devri_yenile", "devri_geri_al") for o_ in x["olaylar"]):
                continue
            y = dict(x, olaylar=ters_cevir(x["olaylar"]))
            if y["olaylar"] == x["olaylar"]:
                continue
            denenen += 1
            self.assertEqual(ozet(x), ozet(y), s["ad"])
        self.assertGreaterEqual(denenen, 5)

    def test_ayni_gun_sirasi_acilis_olagan_donem_sonu(self):
        ols = [o("satis_faturasi", "2026-01-31", cari="C1", M=100, K=20), o("kdv_mahsup", ay="2026-01"),
               o("kasa_acilis", "2026-01-31", tutar=5), E.R("yev", "yevmiye")]
        r = M.kos(senaryo(ols))
        self.assertEqual([m["sinif"] for m in r["raporlar"]["yev"]], [0, 1, 2])


# ------------------------------------------------------------------------------------------------ elle senaryolar
class ElleSenaryolar(unittest.TestCase):
    pass


def _senaryo_testi(s):
    def test(self):
        x = dict(s)
        x.update(copy.deepcopy(E.TANIM))
        for et in M.dal_etiketleri(x):
            r = M.kos(x, M.Kurallar.etiketten(et))
            for yol, bek in s["elle"].get(et, {}).items():
                gercek = yol_al(r, yol, bek)
                self.assertEqual(gercek, bek, f"{s['ad']} [{et}] {yol}")
            self.assertTrue(M.tumu_tuttu(r["degismezler"]), f"{s['ad']} [{et}] değişmez: {r['degismezler']}")
            for d in r["devirler"]:
                self.assertTrue(M.tumu_tuttu(d["degismezler"]), f"{s['ad']} [{et}] devir değişmezi: {d['degismezler']}")
            for ad, rap in r["raporlar"].items():
                if isinstance(rap, dict) and "degismezler" in rap:
                    self.assertTrue(M.tumu_tuttu(rap["degismezler"]), f"{s['ad']} [{et}] {ad}: {rap['degismezler']}")
    return test


for _s in E.SENARYOLAR:
    setattr(ElleSenaryolar, "test_" + _s["ad"].replace("-", "_"), _senaryo_testi(_s))


# ------------------------------------------------------------------------------------------------ rastgele (tohumlu)
class Rastgele(unittest.TestCase):
    pass


def _rastgele_testi(tohum):
    def test(self):
        s = U.uret(tohum)
        r = M.kos(s)
        self.assertEqual([x["kod"] for x in r["redler"]], [], "beklenmeyen red")
        self.assertTrue(M.tumu_tuttu(r["degismezler"]), r["degismezler"])
        self.assertTrue(M.tumu_tuttu(r["devirler"][0]["degismezler"]), r["devirler"][0]["degismezler"])
        self.assertTrue(M.tumu_tuttu(r["raporlar"]["yenile"]["degismezler"]), r["raporlar"]["yenile"]["degismezler"])
        # devirden önceki tahmini Gelir Tablosu = arşivin kesin Gelir Tablosu (aynı değerleme işlevi)
        self.assertEqual(r["raporlar"]["gt_canli"]["kalemler"], r["raporlar"]["gt_arsiv"]["kalemler"])
        # devir öncesi canlı bilanço (K) = arşiv bilançosu (K): aktif aynı; Dönem Net Kârı hesaplanmış satırdan 590'a geçer
        bc, ba = r["raporlar"]["bil_canli_K"], r["raporlar"]["bil_arsiv"]
        self.assertEqual(bc["aktif"], ba["aktif"])
        self.assertEqual(bc["donem_net_kari"], ba["pasif"].get("V.F", 0))
        # devir şirketin durumunu değiştirmez: aynı olaylar devirsiz koşulunca son bilanço aktifi ve 1–4 sınıfı bakiyeleri aynı
        r2 = M.kos(U.devirsiz(s))
        self.assertEqual(r["raporlar"]["bil_yeni"]["aktif"], r2["raporlar"]["bil_yeni"]["aktif"])
        b1 = {k: v for k, v in r["raporlar"]["mz_yeni"]["satirlar"].items() if k[0] in "1234" and k != "153" and v["bakiye"]}
        b2 = {k: v["bakiye"] for k, v in r2["raporlar"]["mz_yeni"]["satirlar"].items() if k[0] in "1234" and k != "153" and v["bakiye"]}
        self.assertEqual({k: v["bakiye"] for k, v in b1.items()}, b2)
        # EK-1 M2 + §4 (4): her carinin gecikmiş tutarı devirli ve devirsiz koşuda aynı (Devri Yenile sonrası dahil)
        self.assertEqual(r["raporlar"]["gec_ocak"], r2["raporlar"]["gec_ocak"])
        self.assertEqual(r["raporlar"]["gec_son"], r2["raporlar"]["gec_son"])
    return test


for _t in U.TOHUMLAR:
    setattr(Rastgele, f"test_tohum_{_t}", _rastgele_testi(_t))


# ------------------------------------------------------------------------------------------------ değişmez denetçileri (dişleri var mı)
class DegismezDenetcileri(unittest.TestCase):
    def _model(self, olaylar):
        m = M.Model(senaryo(olaylar))
        m.kos()
        return m

    def test_devir_tamamlayici_fis_eksikse_kapanis_acilis_tutmaz(self):
        m = self._model([o("satis_faturasi", "2026-05-01", cari="C1", M=1000), o("devir", K="2026-12-31")])
        yeni, arsiv = m.canli, m.arsivler[0]
        did = m.devirler[0]["id"]
        self.assertTrue(M.tumu_tuttu(M.devir_degismezleri(arsiv, yeni, "2026-12-31", None, did)))
        yeni.fisler = [f for f in yeni.fisler if f.tur != "devir_acilis"]
        yeni.degisti()
        d = M.devir_degismezleri(arsiv, yeni, "2026-12-31", None, did)
        self.assertTrue(d["kapanis_acilis"])
        self.assertTrue(d["g_eslesme"])

    def test_modulu_olmayan_madde_modul_defter_farki_verir(self):
        m = self._model([o("kasa_acilis", "2026-01-01", tutar=100)])
        m.canli.fis_ekle("2026-01-02", 1, "x", [M.Bo("100", 50), M.Al("500", 50)])
        self.assertTrue(M.modul_defter_farki(m.canli, "2026-12-31"))

    def test_gelir_tablosuna_dokunan_devir_maddesi_yakalanir(self):
        m = self._model([o("satis_faturasi", "2026-05-01", cari="C1", M=1000), o("devir", K="2026-12-31")])
        did = m.devirler[0]["id"]
        m.canli.fis_ekle("2027-01-01", 0, "devir_acilis", [M.Bo("519", 5), M.Al("600", 5)], kaynak=did)
        d = M.devir_degismezleri(m.arsivler[0], m.canli, "2026-12-31", None, did)
        self.assertTrue(d["yeni_gt_sifir"])

    def _devirli(self):
        m = self._model([o("cari_acilis", "2026-01-01", id="AC1", cari="C1", yon="borc", tutar=1000),
                         o("satis_faturasi", "2026-12-10", id="F1", cari="C1", M=3000, vade="2027-02-01"),
                         o("tahsilat", "2027-01-05", cari="C1", yol="nakit", tutar=500), o("devir", K="2026-12-31")])
        return m, m.canli, m.arsivler[0], m.devirler[0]["id"]

    def test_devreden_kalem_eksikse_m13_ve_tyk_yakalar(self):
        m, yeni, arsiv, did = self._devirli()
        self.assertTrue(M.tumu_tuttu(M.devir_degismezleri(arsiv, yeni, "2026-12-31", None, did)))
        self.assertEqual(M.tyk_degismezleri(yeni, "2027-01-31"), [])
        k = next(k for k in yeni.kaynaklar.values() if k.tur == "devir_cari")
        k.v["kalemler"] = k.v["kalemler"][1:]
        yeni.degisti()
        self.assertTrue(M.devir_degismezleri(arsiv, yeni, "2026-12-31", None, did)["m13_ayri"])
        self.assertTrue(M.tyk_degismezleri(yeni, "2027-01-31"))

    def test_devreden_kalemin_vadesi_degisirse_m2_yakalar(self):
        m, yeni, arsiv, did = self._devirli()
        devirsiz = M.devirsiz_dosya(arsiv, yeni, did)
        self.assertEqual(M.devir_degismezleri(arsiv, yeni, "2026-12-31", None, did, devirsiz=devirsiz)["m2_gecikmis_ayni"], [])
        k = next(k for k in yeni.kaynaklar.values() if k.tur == "devir_cari")
        k.v["kalemler"][-1]["vade"] = "2027-01-01"                  # M2 C: vadesiz / K+1
        yeni.degisti()
        self.assertTrue(M.devir_degismezleri(arsiv, yeni, "2026-12-31", None, did, devirsiz=devirsiz)["m2_gecikmis_ayni"])

    def test_kural_farki_fisi_yanlis_hesapta_yakalanir(self):
        m = self._model([o("kasa_acilis", "2026-01-01", tutar=100), o("donem_kilitle", tarih="2026-12-31", kural="2.4.9"),
                         o("kural_farki_duzelt")])
        d = m.canli
        self.assertEqual(M.degismezler(d, "2027-01-01")["kural_farki_yeni_kural"], [])
        f = next(f for f in d.fisler if f.tur == "kural_farki")
        f.satirlar = [M.L("101.01" if x["h"] == "500" else x["h"], x["b"] - x["a"], x["c"]) for x in f.satirlar]
        d.degisti()
        self.assertTrue(M.degismezler(d, "2027-01-01")["kural_farki_yeni_kural"])

    def test_tek_acilis_fisi_ikinci_fiste_yakalanir(self):
        # karar (7): yevmiyede tek açılış fişi — aynı devirden ikinci N-13 fişi değişmezi kırar
        m = self._model([o("satis_faturasi", "2026-05-01", cari="C1", M=1000), o("kasa_acilis", "2026-01-01", tutar=50),
                         o("devir", K="2026-12-31")])
        yeni, arsiv, did = m.canli, m.arsivler[0], m.devirler[0]["id"]
        self.assertEqual(M.devir_degismezleri(arsiv, yeni, "2026-12-31", None, did)["tek_acilis_fisi"], [])
        f = next(f for f in yeni.fisler if f.tur == "devir_acilis")
        yeni.fis_ekle(f.tarih, 0, "devir_acilis", [dict(s) for s in f.satirlar], dict(f.ek), kaynak=did)
        self.assertTrue(M.devir_degismezleri(arsiv, yeni, "2026-12-31", None, did)["tek_acilis_fisi"])

    def test_m27_net_satir_secimi_etkiliyse_yakalanir(self):
        # EK-2 27 / §4 (4): devir net satırının vade seçimi sonucu değiştirmemeli; borç gibi davranan (vadesi geçmiş) net satır yakalanır
        m = self._model([o("satis_faturasi", "2026-11-01", id="F1", cari="C1", M=10000), o("tahsilat", "2026-11-05", cari="C2", yol="nakit", tutar=8000),
                         o("devir", K="2026-12-31")])
        yeni, arsiv, did = m.canli, m.arsivler[0], m.devirler[0]["id"]
        self.assertEqual(M.devir_degismezleri(arsiv, yeni, "2026-12-31", None, did)["m27_net_satir"], [])
        k = next(k for k in yeni.kaynaklar.values() if k.tur == "devir_cari" and k.v["cari"] == "C2")
        for kl in k.v["kalemler"]:
            if kl["tur"] == "devir_net":
                kl.update(taraf="b", vade="2026-06-01")
        yeni.degisti()
        self.assertTrue(M.devir_degismezleri(arsiv, yeni, "2026-12-31", None, did)["m27_net_satir"])

    def test_kasa_acilis_ilk_hareketten_sonra_yakalanir(self):
        # EK-2 §4 (8): Kasa açılış tarihi ≤ ilk nakit hareketi. Kâhin bakımı 3 (S12 A, README T10): açılıştan önce tarihli hareket artık
        # REDDEDİLİR (eski: kabul + değişmez kırmızı, "KÂHİN SUSUYOR"); değişmezin dişi aynı durum modelin reddi atlanarak kurulunca görülür
        m = self._model([o("kasa_acilis", "2026-01-05", tutar=100), o("kasa_giris", "2026-01-03", tutar=10)])
        self.assertEqual([x["kod"] for x in m.redler], ["KASA_ACILIS_ONCE"])
        self.assertEqual(M.degismezler(m.canli, "2026-01-31")["kasa_acilis_ilk"], [])
        m.canli.kaynak_ekle("kasa_giris", "2026-01-03", {"tutar": 10})
        self.assertTrue(M.degismezler(m.canli, "2026-01-31")["kasa_acilis_ilk"])
        m = self._model([o("kasa_acilis", "2026-01-05", tutar=100), o("kasa_giris", "2026-01-05", tutar=10)])
        self.assertEqual(m.redler, [])
        self.assertEqual(M.degismezler(m.canli, "2026-01-31")["kasa_acilis_ilk"], [])

    def test_tumu_tuttu(self):
        self.assertTrue(M.tumu_tuttu({"a": [], "b": {"c": []}}))
        self.assertFalse(M.tumu_tuttu({"a": [], "b": {"c": [1]}}))


# ------------------------------------------------------------------------------------------------ senaryo hijyeni (mutasyonda koşmaz)
SERI = {"satis_faturasi": "satis", "satis_iade_faturasi": "satis", "esmm": "esmm"}


class SenaryoHijyeni(unittest.TestCase):
    """Senaryolar programın kabul edeceği sırada mı (ana oturum 05.11 ~19:50, K4 / K5)."""

    def _hepsi(self):
        return [dict(s, **E.TANIM) for s in E.SENARYOLAR] + [U.uret(t) for t in U.TOHUMLAR]

    def test_vuk_muteselsil_sira_tarih(self):
        # aynı seride (ve yılda) sonra girilen belgenin tarihi öncekinden önce olamaz (GECMIS-KARARLAR "NUMARA" sıra-tarih denetimi);
        # Devri Yenile düzeltmesi arşivdeki serinin son tarihinden önce olamaz
        for s in self._hepsi():
            son = {}
            for i, x in enumerate(s["olaylar"]):
                for y in ([x] if x["tur"] != "devri_yenile" else x["duzeltmeler"]):
                    seri = SERI.get(y["tur"])
                    if not seri:
                        continue
                    a = (seri, y["tarih"][:4])
                    self.assertGreaterEqual(y["tarih"], son.get(a, ""), f"{s['ad']} olay {i + 1} {y.get('id')}")
                    son[a] = y["tarih"]

    def test_hesapsiz_hareket_banka_acilisindan_once(self):
        for s in self._hepsi():
            acilis = [x["tarih"] for x in s["olaylar"] if x["tur"] == "banka_acilis"]
            for x in s["olaylar"]:
                if x["tur"] == "hesapsiz_hareket" and acilis:
                    self.assertLess(x["tarih"], min(acilis), s["ad"])

    def test_pos_valoru_is_gunu(self):
        import datetime as dt
        for s in [U.uret(t) for t in U.TOHUMLAR]:
            for x in s["olaylar"]:
                if x.get("yol") == "pos" and x.get("valor"):
                    self.assertLess(dt.date.fromisoformat(x["valor"]).weekday(), 5, s["ad"])


# ------------------------------------------------------------------------------------------------ diskteki dosyalar (mutasyonda koşmaz)
class Dosyalar(unittest.TestCase):
    def test_senaryo_ve_beklenen_dosyalari_guncel(self):
        self.assertEqual(UB.main(denetle=True), 0, "python3 test/bagimsiz/muhasebe/uret_beklenen.py ile yeniden yazın")

    def test_en_az_30_elle_senaryo(self):
        self.assertGreaterEqual(len(E.SENARYOLAR), 30)


if __name__ == "__main__":
    sonuc = unittest.main(verbosity=1, exit=False).result
    # kanıt aracı (tools/kanit.mjs) node:test biçimini okur
    kirmizi = len(sonuc.failures) + len(sonuc.errors)
    print(f"# tests {sonuc.testsRun}")
    print(f"# pass {sonuc.testsRun - kirmizi}")
    print(f"# fail {kirmizi}")
    print(f"# skipped {len(sonuc.skipped)}")
    sys.exit(1 if kirmizi or not sonuc.testsRun else 0)
