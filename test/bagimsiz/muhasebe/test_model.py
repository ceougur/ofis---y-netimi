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

    # ---- kâhin bakımı 4 (beklenenler model değiştirilmeden ÖNCE elle yazıldı; README Y1…Y23)
    def test_S18_avans_evrak_tamami_ayri_borc(self):
        # S18 A (README Y10; bakım 3'ün test_S11_avans_kahin_susar'ının YERİNE): çek kilitli dönemde alındı ama o gün açık borç yoktu (L'de 10000 avans);
        # kilitten sonra F1'i kapattı; karşılıksız kilitten sonra → çekin TAMAMI ayrı borç (vade 10.01), F1 kapalı kalır; kâhin SUSMAZ.
        # Eski beklenti: kahin_susuyor [("S11_AVANS", 10000)] (iki okuma, kural sayılmıyordu).
        r = M.kos(senaryo([o("tahsilat", "2026-11-10", id="P1", cari="C1", yol="cek", evrak="CK1", tutar=10000),
                           o("donem_kilitle", tarih="2026-12-31"),
                           o("satis_faturasi", "2027-01-05", id="F1", cari="C1", M=10000, K=0, vade="2027-03-31"),
                           o("evrak_karsiliksiz", "2027-01-10", id="KS1", evrak="CK1"),
                           E.R("g", "gecikmis", cari="C1", tarih="2027-01-11"), E.R("ak", "acik_kalemler", cari="C1", tarih="2027-01-11")]))
        self.assertNotIn("kahin_susuyor", r["raporlar"]["g"])
        self.assertEqual(r["raporlar"]["g"]["gecikmis"], 10000)
        self.assertEqual([(a["k"], a["kalan"], a["vade"]) for a in r["raporlar"]["ak"]], [("karsiliksiz:KS1", 10000, "2027-01-10")])

    def test_S25_a_kismi_once_supheli(self):
        # S25 (a) A (kâhin bakımı 5, README Z5; bakım 4'ün test_S14_kismi_kahin_susar'ının YERİNE — eski beklenti: kahin_susuyor [("S14_KISMI", 6000)], iki okuma):
        # F5 kısmen aktarıldı (5000 128'de, 5000 120'de), bağlı çek 6000 < 10000 → ÖNCE şüpheli kısım: A 128 5000 (SB), kalan A 120 1000; F5'in 120 kısmı 4000 açık
        # (vade 15.04). 128 = 15000 − 5000 = 10000 (F4); 120 = 20000 − 15000 − 1000 = 4000; 01.06'da gecikmiş 4000, şüpheli 10000; kâhin SUSMAZ, red yok
        r = M.kos(senaryo([o("satis_faturasi", "2026-03-01", id="F4", cari="C3", M=10000, K=0, vade="2026-03-31"),
                           o("satis_faturasi", "2026-03-02", id="F5", cari="C3", M=10000, K=0, vade="2026-04-15"),
                           o("supheliye_al", "2026-05-01", id="SB", cari="C3", tutar=15000),
                           o("tahsilat", "2026-05-20", id="P3", cari="C3", yol="cek", evrak="CK3", tutar=6000, fatura="F5"),
                           E.R("g", "gecikmis", cari="C3", tarih="2026-06-01"), E.R("ak", "acik_kalemler", cari="C3", tarih="2026-06-01"),
                           E.MZ("mz", "2026-01-01", "2026-06-30")]))
        g = r["raporlar"]["g"]
        self.assertNotIn("kahin_susuyor", g)
        self.assertEqual((g["gecikmis"], g["supheli"]), (4000, 10000))
        self.assertEqual(r["raporlar"]["ak"], [{"k": "fatura:F5", "tur": "fatura", "kalan": 4000, "vade": "2026-04-15", "tarih": "2026-03-02"}])
        mz = r["raporlar"]["mz"]["satirlar"]
        self.assertEqual((mz["120|C3"]["bakiye"], mz["128|C3"]["bakiye"]), (4000, 10000))
        self.assertEqual(r["redler"], [])

    # ---- kâhin bakımı 6 (beklenenler model değiştirilmeden ÖNCE elle yazıldı; README X1…X13)
    def test_S39_kart_iade_s25_ile_ayni(self):
        # S39 A (README X1–X6; bakım 5'in test_S25_kart_kahin_susar'ının YERİNE — eski beklenti: açık şüpheli kaydında faturaya bağlı Kredi Kartına İade senaryo
        # hatası, kâhin susar): F4 10000'in tamamı şüpheliye aktarıldı (SB); faturaya bağlı kart iadesi 1000 → S25 / S14 ile aynı: A 128 1000 (SB 10000 → 9000),
        # faturanın 120'de kısmı yok; madde B 309.KK1 1000 / A 128 1000; red yok. S39 B (120 + sınır) olsaydı normal 1000 > 120 bakiyesi 0 → SUPHELI_NORMAL_ASIM
        bas = [o("satis_faturasi", "2026-03-01", id="F4", cari="C3", M=10000, K=0, vade="2026-03-31")]
        r = M.kos(senaryo(bas + [o("supheliye_al", "2026-05-01", id="SB", cari="C3", tutar=10000),
                                 o("tahsilat", "2026-05-10", id="KI", cari="C3", yol="kart", kart="KK1", tutar=1000, fatura="F4"),
                                 E.R("sk", "supheli_kayitlari", cari="C3"), E.R("yev", "yevmiye", bas="2026-05-10", son="2026-05-10"),
                                 E.MZ("mz", "2026-01-01", "2026-06-30")]))
        mz = r["raporlar"]["mz"]["satirlar"]
        self.assertEqual(r["redler"], [])
        self.assertEqual((mz["128|C3"]["bakiye"], mz.get("120|C3", {}).get("bakiye", 0), mz["309.KK1"]["bakiye"]), (9000, 0, 1000))
        self.assertEqual(r["raporlar"]["sk"][0]["kalan"], 9000)
        self.assertEqual([satirlar(m) for m in r["raporlar"]["yev"]], [{"309.KK1": 1000, "128|C3": -1000}])
        # açık şüpheli kaydı yoksa bağlı kart iadesi 120'de (plan §3.11b/2 (b); DEĞİŞMEDİ)
        r = M.kos(senaryo(bas + [o("tahsilat", "2026-05-10", cari="C3", yol="kart", kart="KK1", tutar=1000, fatura="F4"),
                                 E.MZ("mz", "2026-01-01", "2026-06-30")]))
        self.assertEqual((r["redler"], r["raporlar"]["mz"]["satirlar"]["120|C3"]["bakiye"]), ([], 9000))
        # bağsız kart iadesi şüpheli caride K3 genel kuralıyla önce 128 (EK-2 Soru 31 (b); DEĞİŞMEDİ)
        r = M.kos(senaryo(bas + [o("supheliye_al", "2026-05-01", id="SB", cari="C3", tutar=6000),
                                 o("tahsilat", "2026-05-10", cari="C3", yol="kart", kart="KK1", tutar=1000),
                                 E.MZ("mz", "2026-01-01", "2026-06-30")]))
        mz = r["raporlar"]["mz"]["satirlar"]
        self.assertEqual((r["redler"], mz["128|C3"]["bakiye"], mz["120|C3"]["bakiye"]), ([], 5000, 4000))

    # ---- kâhin bakımı 7 (beklenenler model değiştirilmeden ÖNCE elle yazıldı; README V1…V10)
    def test_S40_S44_S45_kapsam_ve_susma(self):
        # Bakım 6'nın test_S40_kapsam_disi_kahin_susar'ının YERİNE (G3) — eski beklenti: PY {"fatura": "F1"} ve PY {"normal_cari": True} senaryo hatası (X11 (a)),
        # bağlı PB'nin {"cari": "C3"}'ü senaryo hatası (X11 (b)). Yeni: S44 A (README V1–V3) bağ / Normal Cari düzeltmesi KABUL; S45 A (V5) bağlı kaydın carisi
        # BAG_KALDIRILMALI ile RED; aynı cari kabul; S40 bölümleri (cari, açıklama, tutar + açıklama, tarih red) AYNEN. Kâhinin hâlâ sustuğu (senaryo hatası):
        # X11 (a)'nın kalanı (banka), V7 (aynı düzeltmede bağ + cari; KULLANICIYA SORULMALI 1), X11 (c) / V10 (carisiz Kasa kaydına cari ya da bağ), V3 (c) (hedef
        # kayıttan SONRA tarihli — KULLANICIYA SORULMALI 2; başka carinin faturası / kartı), V3 (e) (formdaki peşin), V3 (d) (SINIR aşımı — KULLANICIYA SORULMALI 3)
        # S40 bölümü (bakım 6'nın kabul ve tarih reddi beklentileri; AYNEN, eski veriyle)
        bas_eski = [o("satis_faturasi", "2026-01-20", id="F1", cari="C1", M=1000, K=0),
                    o("kasa_acilis", "2026-02-01", id="KA", tutar=10000, yedekten=True),
                    o("kasa_giris", "2026-01-24", id="KY", tutar=200, yedekten=True),
                    o("tahsilat", "2026-01-25", id="PY", cari="C1", yol="nakit", tutar=500, yedekten=True),
                    o("tahsilat", "2026-01-26", id="PB", cari="C1", yol="nakit", tutar=300, fatura="F1", yedekten=True)]
        r = M.kos(senaryo(bas_eski + [o("duzenle", kaynak="PY", degisiklik={"cari": "C3"}),
                                      o("duzenle", kaynak="KY", degisiklik={"aciklama": "sayım farkı"}),
                                      o("duzenle", kaynak="PB", degisiklik={"tutar": 400, "aciklama": "düzeltme"}),
                                      E.R("mu", "mutabakat_uyarilari", tarih="2026-02-28"), E.MZ("mz", "2026-01-01", "2026-02-28")]))
        # Kasa = 10000 + 200 + 500 + 400; 120|C1 = 1000 − 400 (PB, F1'e bağlı); 120|C3 = −500 (PY'nin carisi C3 oldu, C3'te açık borç yok → alacaklı); uyarı sürer
        s = r["raporlar"]["mz"]["satirlar"]
        self.assertEqual(r["redler"], [])
        self.assertEqual((s["100"]["bakiye"], s["120|C1"]["bakiye"], s["120|C3"]["bakiye"]), (11100, 600, -500))
        self.assertEqual([u["kaynak"] for u in r["raporlar"]["mu"]], ["KY", "PY", "PB"])
        self.assertTrue(M.tumu_tuttu(r["degismezler"]), r["degismezler"])
        bas = [o("satis_faturasi", "2026-01-20", id="F1", cari="C1", M=1000, K=0),
               o("satis_faturasi", "2026-01-21", id="F3", cari="C3", M=500, K=0),
               o("satis_faturasi", "2026-01-22", id="F5", cari="C1", M=400, K=0),
               o("taksit_karti", "2026-01-23", id="TK3", cari="C3", kaynak="yeni_borc", toplam=100, taksitler=[{"vade": "2026-02-23", "tutar": 100}]),
               o("kasa_acilis", "2026-02-01", id="KA", tutar=10000, yedekten=True),
               o("kasa_giris", "2026-01-24", id="KY", tutar=200, yedekten=True),
               o("tahsilat", "2026-01-22", id="PP", cari="C1", yol="nakit", tutar=400, fatura="F5", fatura_odemesi=True, yedekten=True),
               o("tahsilat", "2026-01-25", id="PY", cari="C1", yol="nakit", tutar=500, yedekten=True),
               o("tahsilat", "2026-01-26", id="PB", cari="C1", yol="nakit", tutar=300, fatura="F1", yedekten=True),
               o("satis_faturasi", "2026-01-28", id="F9", cari="C1", M=700, K=0),                  # kayıtlardan SONRA tarihli
               o("taksit_karti", "2026-01-28", id="TK9", cari="C1", kaynak="yeni_borc", toplam=100, taksitler=[{"vade": "2026-02-28", "tutar": 100}])]
        # kâhin bakımı 8 (G3, README U8): V7 (PB cari + bağ) → S54 KABUL, V3 (c) hedef kayıttan sonra (PY F9 / TK9) → S55 KABUL — aşağıda ayrı;
        # yeni susma örneği: yeni bağ eski carinin başka belgesine (PB cari C3 + F5)
        for kaynak, dg in (("PY", {"banka": "B1"}),                          # X11 (a)'nın kalanı
                           ("PB", {"cari": "C3", "fatura": "F5"}),           # V3 (c): yeni bağ başka (eski) carinin belgesine
                           ("KY", {"cari": "C1"}),                           # X11 (c)
                           ("KY", {"fatura": "F1"}),                         # V10: carisiz kayda bağ
                           ("PY", {"fatura": "F3"}),                         # V3 (c): başka carinin faturası
                           ("PY", {"taksit_karti": "TK3"}),                  # V3 (c): başka carinin kartı
                           ("PP", {"fatura": None})):                        # V3 (e): formdaki peşinin bağı (bakım 10 KS 2; aynen)
            with self.assertRaises(AssertionError, msg=f"{kaynak} {dg}"):
                M.kos(senaryo(bas + [o("duzenle", kaynak=kaynak, degisiklik=dg)]))
        # kâhin bakımı 10 (G3, README L1): PP {"cari": "C3"} bakım 7–9'da V3 (e) senaryo hatasıydı → S80 A: FATURA_DUZENLENMELI ile RED (tamamı; Kasa ve 120 değişmez)
        r = M.kos(senaryo(bas + [o("duzenle", kaynak="PP", degisiklik={"cari": "C3"}), E.MZ("mz", "2026-01-01", "2026-02-28")]))
        self.assertEqual([x["kod"] for x in r["redler"]], ["FATURA_DUZENLENMELI"])
        # 120|C1 = 1000 + 400 + 700 + 100 − 400 − 500 − 300 = 1000 (PP C1'de kaldı); 120|C3 = 500 + 100 = 600
        self.assertEqual((r["raporlar"]["mz"]["satirlar"]["120|C1"]["bakiye"], r["raporlar"]["mz"]["satirlar"]["120|C3"]["bakiye"]), (1000, 600))
        # S44 kabul + S45 red + aynı cari kabul
        r = M.kos(senaryo(bas + [o("duzenle", kaynak="PY", degisiklik={"fatura": "F1"}),
                                 o("duzenle", kaynak="PY", degisiklik={"normal_cari": True}),     # şüpheli kaydı yok → kabul, sonuç değişmez
                                 o("duzenle", kaynak="PB", degisiklik={"cari": "C3"}),            # S45: BAG_KALDIRILMALI
                                 o("duzenle", kaynak="PB", degisiklik={"cari": "C1"}),            # aynı cari → kabul
                                 E.R("mu", "mutabakat_uyarilari", tarih="2026-02-28"), E.MZ("mz", "2026-01-01", "2026-02-28"),
                                 E.R("ak", "acik_kalemler", cari="C1", tarih="2026-03-01")]))
        # Kasa = 10000 + 200 + 400 + 500 + 300; 120|C1 = 1000 + 400 + 700 + 100 − 400 − 500 − 300 = 1000; 120|C3 = 500 + 100; F1 = 1000 − PY 500 − PB 300 = 200 açık
        s = r["raporlar"]["mz"]["satirlar"]
        self.assertEqual([x["kod"] for x in r["redler"]], ["BAG_KALDIRILMALI"])
        self.assertEqual((s["100"]["bakiye"], s["120|C1"]["bakiye"], s["120|C3"]["bakiye"]), (11400, 1000, 600))
        self.assertEqual([u["kaynak"] for u in r["raporlar"]["mu"]], ["PP", "KY", "PY", "PB"])
        self.assertEqual(r["raporlar"]["ak"][0], {"k": "fatura:F1", "tur": "fatura", "kalan": 200, "vade": "2026-01-20", "tarih": "2026-01-20"})
        self.assertTrue(M.tumu_tuttu(r["degismezler"]), r["degismezler"])
        # bağsız kayıtta cari + yeni carinin faturasına bağ AYNI düzeltmede → kabul (S40 + S44; X10 ilkesi): PY C3'e, F3'e bağlı → F3 kapanır, açık yalnız TK3 taksiti
        r = M.kos(senaryo(bas + [o("duzenle", kaynak="PY", degisiklik={"cari": "C3", "fatura": "F3"}), E.MZ("mz", "2026-01-01", "2026-02-28"),
                                 E.R("ak", "acik_kalemler", cari="C3", tarih="2026-03-01")]))
        s = r["raporlar"]["mz"]["satirlar"]
        self.assertEqual(r["redler"], [])
        self.assertEqual((s["120|C1"]["bakiye"], s["120|C3"]["bakiye"]), (1500, 100))
        self.assertEqual(r["raporlar"]["ak"], [{"k": "kart:TK3", "tur": "taksit", "kalan": 100, "vade": "2026-02-23", "tarih": "2026-01-23"}])
        # tarih açılıştan önceki başka bir güne değişirse düzeltmenin TAMAMI T12 ile red (S40 açıklama aynen; S44 bağ da)
        for dg in ({"aciklama": "x", "tarih": "2026-01-27"}, {"fatura": "F1", "tarih": "2026-01-27"}):
            r = M.kos(senaryo(bas + [o("duzenle", kaynak="PY", degisiklik=dg)]))
            self.assertEqual([x["kod"] for x in r["redler"]], ["KASA_ACILIS_ONCE"], dg)
        # açılıştan sonraya alınan bağ düzeltmesi genel kural: kabul, PY uyarıdan çıkar (Z9 / X10 aynen)
        r = M.kos(senaryo(bas + [o("duzenle", kaynak="PY", degisiklik={"fatura": "F9", "tarih": "2026-02-05"}),
                                 E.R("mu", "mutabakat_uyarilari", tarih="2026-02-28")]))
        self.assertEqual((r["redler"], [u["kaynak"] for u in r["raporlar"]["mu"]]), ([], ["PP", "KY", "PB"]))
        # kâhin bakımı 8 — S54 A (README U1, U2): bağlı PB'nin AYNI düzeltmede carisi + bağı → KABUL (bakım 7'de V7 senaryo hatası). Bağ kaldırıldı ya da yeni
        # carinin faturasına: PB 300 C3'te F3'ü kapatır (bağsız da S2 ile F3) → C3 açık F3 200 + TK3 100; 120|C1 = 1000 + 400 + 700 + 100 − 400 − 500 = 1300, 120|C3 = 300
        for dg in ({"cari": "C3", "fatura": None}, {"cari": "C3", "fatura": "F3"}):
            r = M.kos(senaryo(bas + [o("duzenle", kaynak="PB", degisiklik=dg), E.MZ("mz", "2026-01-01", "2026-02-28"),
                                     E.R("ak", "acik_kalemler", cari="C3", tarih="2026-03-01")]))
            s = r["raporlar"]["mz"]["satirlar"]
            self.assertEqual(r["redler"], [], dg)
            self.assertEqual((s["120|C1"]["bakiye"], s["120|C3"]["bakiye"]), (1300, 300), dg)
            self.assertEqual(r["raporlar"]["ak"], [{"k": "fatura:F3", "tur": "fatura", "kalan": 200, "vade": "2026-01-21", "tarih": "2026-01-21"},
                                                   {"k": "kart:TK3", "tur": "taksit", "kalan": 100, "vade": "2026-02-23", "tarih": "2026-01-23"}], dg)
            self.assertTrue(M.tumu_tuttu(r["degismezler"]), r["degismezler"])
        # S55 A (README U3): hedef kayıttan SONRA (F9 28.01 > PY 25.01) → bağ hedefin doğduğu gün; PY F1'e gitmez → F1 1000 − PB 300 = 700, F9 700 − 500 = 200
        r = M.kos(senaryo(bas + [o("duzenle", kaynak="PY", degisiklik={"fatura": "F9"}), E.R("ak", "acik_kalemler", cari="C1", tarih="2026-03-01")]))
        self.assertEqual(r["redler"], [])
        self.assertEqual([(a["k"], a["kalan"]) for a in r["raporlar"]["ak"]], [("fatura:F1", 700), ("fatura:F9", 200), ("kart:TK9", 100)])
        self.assertTrue(M.tumu_tuttu(r["degismezler"]), r["degismezler"])
        # S55 A: kart TK9 (28.01) kayıttan sonra açılmış; tutar 100'e düzeltilir (S26) → PY TK9'un taksitini kapatır; F1 700, F9 700 açık
        r = M.kos(senaryo(bas + [o("duzenle", kaynak="PY", degisiklik={"taksit_karti": "TK9", "tutar": 100}),
                                 E.R("ak", "acik_kalemler", cari="C1", tarih="2026-03-01"), E.MZ("mz", "2026-01-01", "2026-02-28")]))
        self.assertEqual(r["redler"], [])
        self.assertEqual([(a["k"], a["kalan"]) for a in r["raporlar"]["ak"]], [("fatura:F1", 700), ("fatura:F9", 700)])
        self.assertEqual((r["raporlar"]["mz"]["satirlar"]["120|C1"]["bakiye"], r["raporlar"]["mz"]["satirlar"]["100"]["bakiye"]), (1400, 11000))
        self.assertTrue(M.tumu_tuttu(r["degismezler"]), r["degismezler"])
        # V3 (d) SINIR: F4 10000, SA 9000 → 120 bakiyesi 1000; PN 3000 128'den. Normal Cari ile 3000 > 1000 → bakım 8 S56 A (README U5): SUPHELI_NORMAL_ASIM ile
        # RED (bakım 7'de kâhin susuyordu — KULLANICIYA SORULMALI 3); tutar 1000'e düzeltilip Normal Cari seçilirse 1000 = 1000 → kabul (sınır "aşamaz"): 120|C3 0, 128|C3 9000, Kasa 11000
        bas2 = [o("satis_faturasi", "2026-01-02", id="F4", cari="C3", M=10000, K=0),
                o("supheliye_al", "2026-01-05", id="SA", cari="C3", tutar=9000),
                o("kasa_acilis", "2026-01-15", id="KA", tutar=10000),
                o("tahsilat", "2026-01-10", id="PN", cari="C3", yol="nakit", tutar=3000, yedekten=True)]
        r = M.kos(senaryo(bas2 + [o("duzenle", kaynak="PN", degisiklik={"normal_cari": True}), E.MZ("mz", "2026-01-01", "2026-01-31")]))
        self.assertEqual([x["kod"] for x in r["redler"]], ["SUPHELI_NORMAL_ASIM"])
        self.assertEqual(r["raporlar"]["mz"]["satirlar"]["128|C3"]["bakiye"], 6000)
        r = M.kos(senaryo(bas2 + [o("duzenle", kaynak="PN", degisiklik={"normal_cari": True, "tutar": 1000}), E.MZ("mz", "2026-01-01", "2026-01-31")]))
        s = r["raporlar"]["mz"]["satirlar"]
        self.assertEqual(r["redler"], [])
        self.assertEqual((s.get("120|C3", {}).get("bakiye", 0), s["128|C3"]["bakiye"], s["100"]["bakiye"]), (0, 9000, 11000))

    def test_S79_olagan_kayit_bag_cari(self):
        # kâhin bakımı 9 (README P5–P7; G3: bakım 8'in test_S57_olagan_kayit_susma'sının YERİNE — orada PB {C3, F3} ve PB {C3, null} senaryo hatasıydı,
        # S79 A ile KABUL). Bağ değişmeden cari → S57 red aynen. Susar (senaryo hatası): yeni bağ yeni carinin etkin belgesi / kartı değil (P7 a), ödemede
        # taksit kartı (P7 b); bakım 10'a kadar ayrıca formdaki peşin (P7 c; U7 (b)) ve yeni carinin açık şüpheli kaydıyla S56 sınırı aşılıyor (P7 d) — artık red (aşağıda)
        bas = [o("satis_faturasi", "2026-01-05", id="F1", cari="C1", M=1000, K=0), o("satis_faturasi", "2026-01-05", id="F2", cari="C1", M=300, K=0),
               o("satis_faturasi", "2026-01-06", id="F3", cari="C3", M=500, K=0), o("satis_faturasi", "2026-01-06", id="F6", cari="C2", M=1000, K=0),
               o("taksit_karti", "2026-01-07", id="TK1", cari="C1", kaynak="yeni_borc", toplam=300, taksitler=[{"vade": "2026-02-01", "tutar": 300}]),
               o("taksit_karti", "2026-01-07", id="TK3", cari="C3", kaynak="yeni_borc", toplam=400, taksitler=[{"vade": "2026-02-01", "tutar": 400}]),
               o("supheliye_al", "2026-01-08", id="SA", cari="C2", tutar=900),                 # C2: 128 900, 120 100
               o("alis_faturasi", "2026-01-05", id="A1", cari="T1", fatura_turu="gider", gider_turu="genel", M=1000, K=0),
               o("tahsilat", "2026-01-10", id="PB", cari="C1", yol="havale", banka="B1", tutar=400, fatura="F1"),
               o("tahsilat", "2026-01-06", id="PP", cari="C3", yol="havale", banka="B1", tutar=100, fatura="F3", fatura_odemesi=True),
               o("odeme", "2026-01-10", id="OA", cari="T1", yol="havale", banka="B1", tutar=400, fatura="A1")]

        def kos(kaynak, dg):
            return M.kos(senaryo(bas + [o("duzenle", kaynak=kaynak, degisiklik=dg)]))

        for kaynak, dg in (("PB", {"cari": "C3", "fatura": "F3"}), ("PB", {"cari": "C3", "fatura": None}),
                           ("PB", {"cari": "C3", "fatura": None, "taksit_karti": "TK3"}), ("PB", {"cari": "C3", "fatura": "F3", "tutar": 300}),
                           ("PB", {"cari": "C3", "fatura": "F3", "tarih": "2026-01-12"}), ("OA", {"cari": "T2", "fatura": None}),
                           ("PB", {"cari": "C2", "fatura": None}), ("PB", {"cari": "C2", "fatura": "F6"})):   # son ikisi: sınır aşılmıyor (K3 / S25 (a) 128'den)
            self.assertEqual([x["kod"] for x in kos(kaynak, dg)["redler"]], [], f"{kaynak} {dg}")
        for dg in ({"cari": "C3"}, {"cari": "C3", "fatura": "F1"}, {"cari": "C3", "tutar": 300}):
            self.assertEqual([x["kod"] for x in kos("PB", dg)["redler"]], ["BAG_KALDIRILMALI"], dg)
        for kaynak, dg in (("PB", {"cari": "C3", "fatura": "F2"}), ("PB", {"cari": "C3", "fatura": "F6"}),
                           ("PB", {"cari": "C3", "fatura": None, "taksit_karti": "TK1"}), ("OA", {"cari": "T2", "fatura": None, "taksit_karti": "TK3"})):
            with self.assertRaises(AssertionError, msg=f"{kaynak} {dg}"):
                kos(kaynak, dg)
        # kâhin bakımı 10 (G3, README L1, L2, L5, L6): bakım 9'da senaryo hatası olan P7 (c) PP (formdaki peşin) → S80 A: FATURA_DUZENLENMELI; P7 (d) PB → C2 Normal
        # Cari (400 > C2'nin 120 bakiyesi 100) → S81 A: SUPHELI_NORMAL_ASIM
        for kaynak, dg, kod in (("PP", {"cari": "C1"}, "FATURA_DUZENLENMELI"), ("PP", {"cari": "C1", "fatura": "F1"}, "FATURA_DUZENLENMELI"),
                                ("PB", {"cari": "C2", "fatura": None, "normal_cari": True}, "SUPHELI_NORMAL_ASIM")):
            self.assertEqual([x["kod"] for x in kos(kaynak, dg)["redler"]], [kod], f"{kaynak} {dg}")

    def test_S79_S54_ile_ayni(self):
        # kâhin bakımı 9 (README P8): aynı düzeltme olağan kayıtta (S79) ve geri yüklenmiş, Kasa açılışından önce tarihli kayıtta (S54) aynı cari / kuyruk /
        # kart / hatırlatma / mizan sonucunu verir; fark yalnız Mutabakat Testi uyarısı
        def kur(olagan):
            ek = {} if olagan else {"yedekten": True}
            return senaryo([
                o("satis_faturasi", "2026-01-05", id="F1", cari="C1", M=1000, K=0, vade="2026-01-31"),
                o("satis_faturasi", "2026-01-06", id="F3", cari="C3", M=600, K=0, vade="2026-01-20"),
                o("satis_faturasi", "2026-01-06", id="F5", cari="C3", M=500, K=0, vade="2026-02-28"),
                o("taksit_karti", "2026-01-07", id="TK3", cari="C3", kaynak="yeni_borc", toplam=400, taksitler=[{"vade": "2026-02-01", "tutar": 400}]),
                o("kasa_acilis", "2026-01-01" if olagan else "2026-01-15", id="KA", tutar=1000),
                o("tahsilat", "2026-01-10", id="PA", cari="C1", yol="nakit", tutar=300, fatura="F1", **ek),
                o("tahsilat", "2026-01-11", id="PB", cari="C1", yol="nakit", tutar=200, fatura="F1", **ek),
                o("tahsilat", "2026-01-12", id="PC", cari="C1", yol="nakit", tutar=100, fatura="F1", **ek),
                o("duzenle", kaynak="PA", degisiklik={"cari": "C3", "fatura": "F5", "tutar": 250}),
                o("duzenle", kaynak="PB", degisiklik={"cari": "C3", "fatura": None, "taksit_karti": "TK3"}),
                o("duzenle", kaynak="PC", degisiklik={"cari": "C2", "fatura": None}),
                E.MZ("mz", "2026-01-01", "2026-01-31"), E.R("hat", "hatirlatma", tarih="2026-02-02"), E.R("mu", "mutabakat_uyarilari", tarih="2026-01-31"),
            ] + [E.R(f"{r}-{c}", r, cari=c, tarih="2026-02-02") for r in ("gecikmis", "acik_kalemler", "kartlar") for c in ("C1", "C2", "C3")])
        r1, r2 = M.kos(kur(True)), M.kos(kur(False))
        self.assertEqual((r1["redler"], r2["redler"]), ([], []))
        self.assertEqual(r1["raporlar"]["mu"], [])
        self.assertEqual(len(r2["raporlar"]["mu"]), 3)
        self.assertEqual(r1["raporlar"]["gecikmis-C3"]["gecikmis"], 800)   # F3 600 (PA'nın bağı F5'e) + taksit 400 − 200 (PB); F5 vadesi 28.02
        for ad in r1["raporlar"]:
            if ad != "mu":
                self.assertEqual(r1["raporlar"][ad], r2["raporlar"][ad], ad)

    # ---------------------------------------------------------------------------------------- kâhin bakımı 10 (README L1–L10; beklenenler model değiştirilmeden ÖNCE)
    def test_S80_formdaki_pesin_cari(self):
        # S80 A (README L1–L4): formdaki peşin tahsilatın carisi düzeltilemez → FATURA_DUZENLENMELI, düzeltmenin TAMAMI (olağan ve geri yüklenmiş açılış öncesi kayıtta);
        # kilit ve T12 / B11 önce (L2); carisi aynı peşinin tutarı / açıklaması kabul (L3); alış faturası formundaki peşin ÖDEME kâhinde susar (L4, KS 1)
        bas = [o("satis_faturasi", "2026-01-05", id="F1", cari="C1", M=1000, K=0, vade="2026-01-31"),
               o("tahsilat", "2026-01-05", id="P1", cari="C1", yol="havale", banka="B1", tutar=300, fatura="F1", fatura_odemesi=True),
               o("satis_faturasi", "2026-01-06", id="F3", cari="C3", M=500, K=0),
               o("alis_faturasi", "2026-01-05", id="A1", cari="T1", fatura_turu="gider", gider_turu="genel", M=1000, K=0),
               o("alis_faturasi", "2026-01-06", id="A3", cari="T2", fatura_turu="gider", gider_turu="genel", M=800, K=0),
               o("odeme", "2026-01-05", id="O1", cari="T1", yol="havale", banka="B1", tutar=200, fatura="A1", fatura_odemesi=True)]

        def kos(dg, kaynak="P1", ek=(), b=bas):
            r = M.kos(senaryo(b + list(ek) + [o("duzenle", kaynak=kaynak, degisiklik=dg), E.MZ("mz", "2026-01-01", "2026-01-31"),
                                              E.R("mu", "mutabakat_uyarilari", tarih="2026-01-31")]))
            s = r["raporlar"]["mz"]["satirlar"]
            return [x["kod"] for x in r["redler"]], {h: s[h]["bakiye"] for h in s if h in ("100", "102.B1", "120|C1", "120|C3")}, r
        # olağan: red, kayıt değişmez — 120|C1 = 1000 − 300; 120|C3 500; 102.B1 = 300 − 200
        for dg in ({"cari": "C3"}, {"cari": "C3", "tutar": 250}, {"cari": "C3", "fatura": "F3"}, {"cari": "C3", "fatura": None},
                   {"cari": "C3", "aciklama": "x"}, {"cari": "C3", "tarih": "2026-01-09"}):
            kodlar, s, r = kos(dg)
            self.assertEqual((kodlar, s), (["FATURA_DUZENLENMELI"], {"102.B1": 100, "120|C1": 700, "120|C3": 500}), dg)
            self.assertTrue(M.tumu_tuttu(r["degismezler"]), r["degismezler"])
        self.assertEqual(kos({"cari": "C3"}, ek=[o("donem_kilitle", tarih="2026-01-07")])[0], ["KILITLI_DONEM"])   # kilit önce
        # bugünkü kural: tutar + açıklama kabul (F1 650 açık, 102.B1 150); aynı cari kabul
        self.assertEqual(kos({"tutar": 350, "aciklama": "Peşin"})[:2], ([], {"102.B1": 150, "120|C1": 650, "120|C3": 500}))
        self.assertEqual(kos({"cari": "C1", "aciklama": "Aynı cari"})[:2], ([], {"102.B1": 100, "120|C1": 700, "120|C3": 500}))
        # L4: alış faturası formundaki peşin ödeme — karar metninde yok, kâhin susar
        for dg in ({"cari": "T2"}, {"cari": "T2", "fatura": "A3"}, {"cari": "T2", "fatura": None}):
            with self.assertRaises(AssertionError, msg=f"O1 {dg}"):
                kos(dg, "O1")
        # geri yüklenmiş, Kasa açılışından önce tarihli peşin (S26 / S40 / S44 yolu): red aynı; tarih açılıştan önceki başka güne → T12 önce; açılıştan sonraya → red
        bas2 = [o("satis_faturasi", "2026-01-05", id="F1", cari="C1", M=1000, K=0, vade="2026-01-31"),
                o("kasa_acilis", "2026-01-08", id="KA", tutar=1000),
                o("tahsilat", "2026-01-06", id="P2", cari="C1", yol="nakit", tutar=200, fatura="F1", fatura_odemesi=True, yedekten=True),
                o("satis_faturasi", "2026-01-07", id="F3", cari="C3", M=500, K=0)]
        for dg, kod in (({"cari": "C3"}, "FATURA_DUZENLENMELI"), ({"cari": "C3", "tutar": 250}, "FATURA_DUZENLENMELI"),
                        ({"cari": "C3", "fatura": "F3"}, "FATURA_DUZENLENMELI"), ({"cari": "C3", "tarih": "2026-01-07"}, "KASA_ACILIS_ONCE"),
                        ({"cari": "C3", "tarih": "2026-01-09"}, "FATURA_DUZENLENMELI")):
            kodlar, s, r = kos(dg, "P2", b=bas2)
            self.assertEqual((kodlar, s), ([kod], {"100": 1200, "120|C1": 800, "120|C3": 500}), dg)
            self.assertEqual([u["kaynak"] for u in r["raporlar"]["mu"]], ["P2"], dg)
        kodlar, s, r = kos({"tutar": 250}, "P2", b=bas2)                                         # S26: kabul, uyarı sürer
        self.assertEqual((kodlar, s, [u["kaynak"] for u in r["raporlar"]["mu"]]), ([], {"100": 1250, "120|C1": 750, "120|C3": 500}, ["P2"]))
        with self.assertRaises(AssertionError):                                                 # V3 (e) aynen: peşinin bağı (KS 2)
            kos({"fatura": None}, "P2", b=bas2)

    def test_S81_olagan_duzeltme_siniri(self):
        # S81 A (README L5–L9): olağan tahsilatın düzeltmesi kaydı şüpheli kaydı açık carinin 120'sine (Normal Cari / fatura bağı) alıp 120 bakiyesini aşarsa
        # SUPHELI_NORMAL_ASIM (tamamı); eşitlik kabul; üç yol (S79, bağsız kaydın carisi, aynı carinin seçimi); fatura bağında 128'den düşen sayılmaz; tarih de değişirse
        # sınır YENİ günde (L7); S57 / S80 redleri önce. C2: F6 1000, SA 900 → 120 100, 128 900 (PK 12.01'de 128'den 100 → 800); F8 20.01 → 120 +500
        bas = [o("satis_faturasi", "2026-01-02", id="F6", cari="C2", M=1000, K=0, vade="2026-01-31"),
               o("supheliye_al", "2026-01-03", id="SA", cari="C2", tutar=900),
               o("satis_faturasi", "2026-01-05", id="F1", cari="C1", M=5000, K=0, vade="2026-01-31"),
               o("tahsilat", "2026-01-05", id="PP", cari="C1", yol="havale", banka="B1", tutar=50, fatura="F1", fatura_odemesi=True),
               o("satis_faturasi", "2026-01-20", id="F8", cari="C2", M=500, K=0, vade="2026-02-28"),
               o("tahsilat", "2026-01-10", id="PB", cari="C1", yol="havale", banka="B1", tutar=101, fatura="F1"),
               o("tahsilat", "2026-01-10", id="PE", cari="C1", yol="havale", banka="B1", tutar=100, fatura="F1"),
               o("tahsilat", "2026-01-10", id="PF", cari="C1", yol="havale", banka="B1", tutar=1000, fatura="F1"),
               o("tahsilat", "2026-01-10", id="PN", cari="C1", yol="havale", banka="B1", tutar=101, normal_cari=True),
               o("tahsilat", "2026-01-12", id="PK", cari="C2", yol="havale", banka="B1", tutar=100)]

        def kos(kaynak, dg, son="2026-01-15", ek=()):
            r = M.kos(senaryo(bas + list(ek) + [o("duzenle", kaynak=kaynak, degisiklik=dg), E.MZ("mz", "2026-01-01", son),
                                                E.R("ak", "acik_kalemler", cari="C2", tarih="2026-02-01")]))
            s = r["raporlar"]["mz"]["satirlar"]
            self.assertTrue(M.tumu_tuttu(r["degismezler"]), (kaynak, dg, r["degismezler"]))
            return [x["kod"] for x in r["redler"]], tuple(s.get(h, {}).get("bakiye", 0) for h in ("120|C2", "128|C2")), r
        for kaynak, dg in (("PB", {"cari": "C2", "fatura": None, "normal_cari": True}),                    # (i) S79: 101 > 100
                           ("PB", {"cari": "C2", "fatura": None, "normal_cari": True, "aciklama": "x"}),   # tamamı
                           ("PN", {"cari": "C2"}),                                                       # (ii) bağsız Normal Cari kaydın carisi
                           ("PK", {"normal_cari": True, "tutar": 101})):                                 # (iii) aynı cari (PK hariç 120 100)
            self.assertEqual(kos(kaynak, dg)[:2], (["SUPHELI_NORMAL_ASIM"], (100, 800)), f"{kaynak} {dg}")
        self.assertEqual(kos("PB", {"cari": "C2"})[0], ["BAG_KALDIRILMALI"])                              # S57 önce
        self.assertEqual(kos("PP", {"cari": "C2", "fatura": None, "normal_cari": True})[0], ["FATURA_DUZENLENMELI"])   # S80 önce
        # kabul: eşitlik (PE 100 = 100; PK kendi 100'ü = 100), fatura bağında 128'den düşen sayılmaz (PB 101 tamamı 128'den), fatura bağında 120'de kapanan = 120 (PF:
        # 900 128'den, 100 120'den), şüpheli kaydı olmayan cari (C3)
        self.assertEqual(kos("PE", {"cari": "C2", "fatura": None, "normal_cari": True})[:2], ([], (0, 800)))
        self.assertEqual(kos("PK", {"normal_cari": True})[:2], ([], (0, 900)))
        self.assertEqual(kos("PB", {"cari": "C2", "fatura": "F6"})[:2], ([], (100, 699)))
        self.assertEqual(kos("PF", {"cari": "C2", "fatura": "F6"}, son="2026-01-11")[:2], ([], (0, 0)))
        self.assertEqual(kos("PB", {"cari": "C3", "fatura": None, "normal_cari": True})[0], [])
        # L7: tarih de değişirse sınır YENİ günde — 21.01'de 120|C2 600 → 101 kabul (eski günde 100 olurdu → red); PB F6'nın 120'deki 100'ünü, F8'den 1'i kapatır
        kodlar, s, r = kos("PB", {"cari": "C2", "fatura": None, "normal_cari": True, "tarih": "2026-01-21"}, son="2026-01-31")
        self.assertEqual((kodlar, s), ([], (499, 800)))
        self.assertEqual(r["raporlar"]["ak"], [{"k": "fatura:F8", "tur": "fatura", "kalan": 499, "vade": "2026-02-28", "tarih": "2026-01-20"}])
        # L7 ters yön: 15.01'de C2'nin Normal Cari tahsilatı PZ 50 → 16.01'de 120|C2 50; PE'yi 16.01'e alan düzeltme 100 > 50 → red (eski günde 100 = 100 kabul olurdu)
        pz = [o("tahsilat", "2026-01-15", id="PZ", cari="C2", yol="havale", banka="B1", tutar=50, normal_cari=True)]
        self.assertEqual(kos("PE", {"cari": "C2", "fatura": None, "normal_cari": True, "tarih": "2026-01-16"}, son="2026-01-16", ek=pz)[:2],
                         (["SUPHELI_NORMAL_ASIM"], (50, 800)))

    def test_S81_S56_ile_ayni(self):
        # kâhin bakımı 10 (README L10): aynı düzeltme olağan kayıtta (S81) ve geri yüklenmiş, Kasa açılışından önce tarihli kayıtta (S54 + S56) aynı red / kabul ve sayılar;
        # fark yalnız Mutabakat Testi uyarısı
        def kur(olagan):
            ek = {} if olagan else {"yedekten": True}
            return senaryo([
                o("satis_faturasi", "2026-01-02", id="F6", cari="C2", M=1000, K=0, vade="2026-01-31"),
                o("supheliye_al", "2026-01-03", id="SA", cari="C2", tutar=900),
                o("satis_faturasi", "2026-01-05", id="F1", cari="C1", M=5000, K=0, vade="2026-01-31"),
                o("kasa_acilis", "2026-01-01" if olagan else "2026-01-15", id="KA", tutar=1000),
                o("tahsilat", "2026-01-10", id="PA", cari="C1", yol="nakit", tutar=101, fatura="F1", **ek),
                o("tahsilat", "2026-01-10", id="PB", cari="C1", yol="nakit", tutar=60, fatura="F1", **ek),
                o("tahsilat", "2026-01-11", id="PC", cari="C1", yol="nakit", tutar=40, fatura="F1", **ek),
                o("duzenle", kaynak="PA", degisiklik={"cari": "C2", "fatura": None, "normal_cari": True}),   # 101 > 100 → red
                o("duzenle", kaynak="PB", degisiklik={"cari": "C2", "fatura": None, "normal_cari": True}),   # 60 ≤ 100 → kabul
                o("duzenle", kaynak="PC", degisiklik={"cari": "C2", "fatura": "F6"}),                         # 40 128'den → kabul
                E.MZ("mz", "2026-01-01", "2026-01-31"), E.R("mu", "mutabakat_uyarilari", tarih="2026-01-31"), E.R("hat", "hatirlatma", tarih="2026-02-02"),
            ] + [E.R(f"{r}-{c}", r, cari=c, tarih="2026-02-02") for r in ("gecikmis", "acik_kalemler") for c in ("C1", "C2")])
        r1, r2 = M.kos(kur(True)), M.kos(kur(False))
        self.assertEqual(([x["kod"] for x in r1["redler"]], [x["kod"] for x in r2["redler"]]), (["SUPHELI_NORMAL_ASIM"], ["SUPHELI_NORMAL_ASIM"]))
        self.assertEqual((r1["raporlar"]["mu"], len(r2["raporlar"]["mu"])), ([], 3))
        s = r1["raporlar"]["mz"]["satirlar"]
        # 120|C2 = 100 − 60; 128|C2 = 900 − 40; 120|C1 = 5000 − 101; Kasa = 1000 + 201
        self.assertEqual(tuple(s[h]["bakiye"] for h in ("120|C2", "128|C2", "120|C1", "100")), (40, 860, 4899, 1201))
        for ad in r1["raporlar"]:
            if ad != "mu":
                self.assertEqual(r1["raporlar"][ad], r2["raporlar"][ad], ad)

    def test_S72_S73_soz_kapsami(self):
        # kâhin bakımı 9 (README P1–P3): söz günü dahil etkin (S72); P3: söz girildiği gün carinin gecikmiş borcu yoksa da söz bütün borcu kapsar (S73) —
        # söz süresinde geciken kalem cariyi listeye sokmaz; söz geçince girer
        r = M.kos(senaryo([o("satis_faturasi", "2026-02-01", cari="C1", M=1000, K=0, vade="2026-03-15"),
                           o("odeme_sozu", "2026-03-10", cari="C1", soz_tarihi="2026-03-31"),
                           E.R("h1", "hatirlatma", tarih="2026-03-20"), E.R("h2", "hatirlatma", tarih="2026-03-31"),
                           E.R("h3", "hatirlatma", tarih="2026-04-01")]))["raporlar"]
        self.assertEqual((r["h1"]["otomatik"], r["h1"].get("odeme_sozu_var"), r["h1"].get("kahin_susuyor")), ({}, {"C1": 1000}, None))
        self.assertEqual((r["h2"]["otomatik"], r["h2"].get("odeme_sozu_var"), r["h2"].get("kahin_susuyor")), ({}, {"C1": 1000}, None))
        self.assertEqual((r["h3"]["otomatik"], r["h3"].get("odeme_sozu_var")), ({"C1": 1000}, None))

    def test_S14_hedef_kalem_kapanir(self):
        # README Y3 (bakım 4'te mutant tasarımında görülüp SONRADAN elle eklendi: şüpheli kuyruğunda hangi kalemin kapandığını hiçbir senaryo ölçmüyordu):
        # SB 15000 → şüpheli kuyruğu [F4 10000, F5 5000]; P3 (F5'e bağlı) 128'den 5000 düşer ve F5'in şüpheli kalemini kapatır (vadesi önce gelen F4'ü
        # DEĞİL). Şüpheliden Çıkar kalan kalemleri kendi vadeleriyle döndürür (M13) → açık kalem yalnız F4 10000 (vade 31.03)
        r = M.kos(senaryo([o("satis_faturasi", "2026-03-01", id="F4", cari="C3", M=10000, K=0, vade="2026-03-31"),
                           o("satis_faturasi", "2026-03-02", id="F5", cari="C3", M=10000, K=0, vade="2026-04-15"),
                           o("supheliye_al", "2026-05-01", id="SB", cari="C3", tutar=15000),
                           o("tahsilat", "2026-05-20", id="P3", cari="C3", yol="cek", evrak="CK3", tutar=10000, fatura="F5"),
                           o("supheliden_cikar", "2026-06-10", cari="C3", kayit="SB"),
                           E.R("ak", "acik_kalemler", cari="C3", tarih="2026-06-11"), E.MZ("mz", "2026-01-01", "2026-06-30")]))
        self.assertEqual(r["raporlar"]["ak"], [{"k": "fatura:F4", "tur": "fatura", "kalan": 10000, "vade": "2026-03-31", "tarih": "2026-03-01"}])
        self.assertEqual((r["raporlar"]["mz"]["satirlar"]["120|C3"]["bakiye"], r["raporlar"]["mz"]["satirlar"].get("128|C3", {}).get("bakiye", 0)),
                         (10000, 0))

    def test_S21_tatil_takvimi(self):
        # README Y19 / Y20 (S21 A): nominal valör tam gün resmî tatile (2429) ya da hafta sonuna (K3) düşerse ilk iş günü; tatil + hafta sonu zinciri
        self.assertEqual(M.pos_etkin_valor("2026-04-23"), "2026-04-24")      # 23 Nisan Perşembe → Cuma
        self.assertEqual(M.pos_etkin_valor("2026-05-01"), "2026-05-04")      # 1 Mayıs Cuma → Pazartesi
        self.assertEqual(M.pos_etkin_valor("2026-05-19"), "2026-05-20")
        self.assertEqual(M.pos_etkin_valor("2026-07-15"), "2026-07-16")
        self.assertEqual(M.pos_etkin_valor("2026-08-30"), "2026-08-31")      # Pazar ve tatil
        self.assertEqual(M.pos_etkin_valor("2026-10-29"), "2026-10-30")
        self.assertEqual(M.pos_etkin_valor("2027-01-01"), "2027-01-04")      # yıl dönümü: Cuma → Pazartesi
        self.assertEqual(M.pos_etkin_valor("2027-01-02"), "2027-01-04")      # Cumartesi
        self.assertEqual(M.pos_etkin_valor("2026-04-24"), "2026-04-24")      # iş günü aynen
        self.assertEqual(M.pos_etkin_valor("2026-04-23", tatil=False), "2026-04-23")   # 2.4.9 türetmesi: yalnız hafta sonu (Y22)
        # kâhin bakımı 5 (S27 A, README Z11): 28 Ekim yarım gün → "yarim" (İŞ GÜNÜ; eski beklenti "belirsiz", bakım 4 Y21); bayram takvimi bilinmeyen yılda 28 Ekim
        # belirsiz kalır (Z12)
        self.assertEqual([M.tatil_turu(x) for x in ("2026-04-23", "2026-10-28", "2026-05-27", "2026-04-24", "2028-04-23", "2028-06-01", "2027-10-28",
                                                    "2028-10-28")],
                         ["tam", "yarim", "belirsiz", None, "tam", "belirsiz", "yarim", "belirsiz"])
        self.assertEqual(M.pos_etkin_valor("2026-10-28"), "2026-10-28")      # yarım gün Çarşamba: kaymaz
        self.assertEqual(M.pos_etkin_valor("2027-10-28"), "2027-10-28")      # yarım gün Perşembe: kaymaz
        self.assertEqual(M.pos_etkin_valor("2027-10-29"), "2027-11-01")      # 29 Ekim Cuma (tam) + hafta sonu → Pazartesi
        self.assertEqual(M.pos_etkin_valor("2026-10-28", tatil=False), "2026-10-28")

    def test_S21_belirsiz_valor_kahin_susar(self):
        # README Y21 + kâhin bakımı 5 (S27, Z12): doğrulanmamış dinî bayram penceresi (arife dahil) — kâhin kural kurmaz (senaryo hatası). 28 Ekim artık
        # BELİRSİZ DEĞİL (S27 A: yarım gün iş günü; eski listede "2026-10-28" vardı ve M.kos örneği 28 Ekim valörüyle hata veriyordu)
        for v in ("2026-05-27", "2026-03-19", "2026-05-23", "2026-05-26", "2027-03-08", "2028-10-28"):   # 23.05 Cumartesi → kaydırma yolu pencereye (25.05) değer
            with self.assertRaises(AssertionError, msg=v):
                M.pos_etkin_valor(v)
        with self.assertRaises(AssertionError):
            M.kos(senaryo([o("tahsilat", "2026-05-25", cari="C1", yol="pos", pos="POS1", tutar=1000, valor="2026-05-26")]))
        r = M.kos(senaryo([o("tahsilat", "2026-10-27", cari="C1", yol="pos", pos="POS1", tutar=1000, valor="2026-10-28"),
                           E.R("m", "moduller", tarih="2026-10-28")]))
        self.assertEqual(r["raporlar"]["m"].get("banka|B1"), 1000)

    def test_S27_bayram_tarihleri(self):
        # README Z12 (kâhin bakımı 5): dinî bayram tarihleri yalnız resmî kaynaktan OKUNURSA kural olur. Bu bakımda Diyanet (vakithesaplama.diyanet.gov.tr: 403) ve
        # Resmî Gazete (arşiv sayfaları çoğunlukla zaman aşımı; okunan günlük fihristlerde bayram genelgesi yok) birincil tarih VERMEDİ, mevzuat.gov.tr açılmadı
        # → pencereler (arifeden bir gün önce – bayramdan bir gün sonra) BELİRSİZ kalır; pencere dışı aynen (iş günü). Haber sitesi tarihleri kullanılmadı.
        for s in ("2026-03-18", "2026-03-19", "2026-03-22", "2026-03-23", "2026-05-25", "2026-05-26", "2026-05-30", "2026-05-31",
                  "2027-03-07", "2027-03-08", "2027-03-12", "2027-05-14", "2027-05-15", "2027-05-20"):
            self.assertEqual(M.tatil_turu(s), "belirsiz", s)
        for s in ("2026-03-17", "2026-03-24", "2026-05-22", "2026-06-01", "2027-03-05", "2027-03-15", "2027-05-13", "2027-05-21"):
            self.assertIsNone(M.tatil_turu(s), s)

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

    # ---------------------------------------------------------------------------------------- kâhin bakımı 8 (README W1–W19)
    def test_B6_kg16_eslesmesi(self):
        # W5 (BAŞ MİMAR KARARI B6): baştaki boşluk + Türkçe küçük harf + ç / ı / ş katlama; "Devir" / "Devreden" ve ortadaki "açılış" girmez
        for s in ("AÇILIŞ", "Açilis farkı", "ACILIS", "  açılış", "Açılışlar", "acilis bakiyesi", "AÇİLİŞ"):
            self.assertTrue(M.kg16_aciklamasi(s), s)
        for s in ("Devir bakiyesi", "Devreden", "Yeniden açılış", "Kapanış", "", None, "Aç ılış", "2025 açılış farkı"):   # S65 A: ortada geçen girmez
            self.assertFalse(M.kg16_aciklamasi(s), s)
        self.assertFalse(M.acilis_aciklamasi("Acilis"))            # donmuş 2.4.9 türetmesinin açıklamadan tanıması aynen (W5)

    def test_S47_W4_onay_kapsami(self):
        aday = o("borc_yaz", "2026-01-02", id="BY", cari="C1", tutar=100, aciklama="Açılış", yedekten=True)
        with self.assertRaises(AssertionError):                    # W4: 2.5.0'da konmuş kilidin içindeki adayın onayı → kâhin susar
            M.kos(senaryo([aday, o("donem_kilitle", tarih="2026-01-31"), o("acilis_onayla", kaynak="BY", karar="onay")]))
        with self.assertRaises(AssertionError):                    # W1: 2.5.0'da girilen "Açılış…" Borç Yaz aday değil — onaylanacak bir şey yok
            M.kos(senaryo([o("borc_yaz", "2026-01-02", id="BY", cari="C1", tutar=100, aciklama="Açılış"), o("acilis_onayla", kaynak="BY", karar="onay")]))
        with self.assertRaises(AssertionError):
            M.kos(senaryo([aday, o("acilis_onayla", kaynak="BY", karar="evet")]))
        # W4: göçte 2.4.9 kuralıyla donan dönemde red kabul — donmuş satır 500 kalır, güncel türetme 602.90 (kural farkı)
        r = M.kos(senaryo([aday, o("donem_kilitle", tarih="2026-01-31", kural="2.4.9"), o("acilis_onayla", kaynak="BY", karar="red"),
                           E.R("ao", "acilis_olabilir", tarih="2026-02-01"), E.MZ("mz", "2026-01-01", "2026-02-01"), E.R("f", "kural_farki")]))
        self.assertEqual(r["raporlar"]["ao"][0]["durum"], "reddedildi")
        self.assertEqual(r["raporlar"]["mz"]["satirlar"]["500"]["bakiye"], -100)
        self.assertEqual(r["raporlar"]["f"], {"500": 100, "602.90": -100})

    def test_S48_S49_donmus_2_4_9(self):
        # W7 / W8: donmuş 2.4.9 türetmesi — carisiz açılış evrakının seçilmeden karşılıksızı B 770 / A 101; formdan carisiz alınan A 602, verilen B 770
        r = M.kos(senaryo([
            o("evrak_acilis", "2026-01-01", evrak="CK2", evrak_turu="cek", yon="alinan", durum="portfoy", tutar=5000),
            o("evrak_karsiliksiz", "2026-02-15", evrak="CK2"),
            o("carisiz_evrak", "2026-03-01", evrak="CE1", evrak_turu="cek", yon="alinan", tutar=1000),
            o("carisiz_evrak", "2026-03-02", evrak="CE3", evrak_turu="cek", yon="verilen", tutar=700, banka="B1"),
            o("donem_kilitle", tarih="2026-03-31", kural="2.4.9"), E.R("f", "kural_farki")]))
        # güncel: 519 (açılış ↔ geri alma) 0, 649.90 −1000, 770.90 +700; donmuş: 602 −6000, 770 +5700
        self.assertEqual(r["raporlar"]["f"], {"602": 6000, "649.90": -1000, "770": -5700, "770.90": 700})
        self.assertEqual(r["redler"], [])

    def test_S48_S49_kapsam_susma(self):
        # W7 / W9: kâhinin sustuğu durumlar senaryo hatası (KULLANICIYA SORULMALI 3, 4); carili evrakta başka cari model dilinde yok
        ac = o("evrak_acilis", "2026-01-01", evrak="CK1", evrak_turu="cek", yon="alinan", durum="portfoy", tutar=500)
        ce = o("carisiz_evrak", "2026-01-02", evrak="CE1", evrak_turu="cek", yon="alinan", tutar=300)
        cv = o("carisiz_evrak", "2026-01-02", evrak="CV1", evrak_turu="cek", yon="verilen", tutar=200, banka="B1")
        # bakım 8 ikinci ek (S66 A, README Q2, G3 Q5): formdan carisiz alınan evrakın karşılıksızı artık KURAL (s99) — susma listesinden çıktı
        for ols in ([ce, o("odeme", "2026-01-03", cari="T1", yol="ciro", evrak="CE1"), o("evrak_karsiliksiz", "2026-01-05", evrak="CE1")],
                    [cv, o("verilen_evrak_geri_al", "2026-01-05", evrak="CV1")],
                    [ac, o("odeme", "2026-01-03", cari="T1", yol="ciro", evrak="CK1"), o("evrak_karsiliksiz", "2026-01-05", evrak="CK1", cari="C1")],
                    [dict(ac, cari="C2"), o("evrak_karsiliksiz", "2026-01-05", evrak="CK1", cari="C1")]):
            with self.assertRaises(AssertionError, msg=str(ols)):
                M.kos(senaryo(ols))

    def test_S52_soz_kapsami(self):
        # W12: söz ileri tarihli olmalı; W13: şüpheli kaydı açık caride S7 önce gelir (söz değerlendirilmez)
        f = o("satis_faturasi", "2026-02-01", cari="C1", M=1000, K=0, vade="2026-02-10")
        for st in ("2026-03-10", "2026-03-09"):
            with self.assertRaises(AssertionError):
                M.kos(senaryo([f, o("odeme_sozu", "2026-03-10", cari="C1", soz_tarihi=st)]))
        r = M.kos(senaryo([f, o("supheliye_al", "2026-03-01", id="S1", cari="C1", tutar=400),
                           o("odeme_sozu", "2026-03-10", cari="C1", soz_tarihi="2026-03-20"), E.R("h", "hatirlatma", tarih="2026-03-15")]))
        self.assertEqual(r["raporlar"]["h"], {"tarih": "2026-03-15", "otomatik": {}, "supheli_etiketli": ["C1"], "elle": {"C1": 600}})

    def test_B5_yerel_gun(self):
        # W16 (BAŞ MİMAR KARARI B5): içe aktarma anının Europe/Istanbul yerel günü — süreç saat diliminden bağımsız
        self.assertEqual(M.yerel_gun("2026-03-09T22:30:00Z"), "2026-03-10")
        self.assertEqual(M.yerel_gun("2026-03-05T20:59:59Z"), "2026-03-05")
        self.assertEqual(M.yerel_gun("2026-03-05T21:00:00+00:00"), "2026-03-06")
        self.assertEqual(M.yerel_gun("2026-12-31T23:30:00+03:00"), "2026-12-31")
        self.assertEqual(M.yerel_gun("2026-12-31T21:30:00Z"), "2027-01-01")
        with self.assertRaises(AssertionError):
            M.yerel_gun("2026-03-09T22:30:00")
        with self.assertRaises(AssertionError):                    # yükleme günü < Kayıt Tarihi (G-4: ileri tarih yok)
            M.kos(senaryo([o("taksit_excel", "2026-03-10", cari="C1", toplam=100, odenen=0, yukleme_ani="2026-03-01T10:00:00Z",
                             taksitler=[{"vade": "2026-04-01", "tutar": 100}])]))

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

    def test_B5_pencere_modul_defter(self):
        # W16 (B5 BİLİNEN SINIR): Kayıt Tarihi ile yükleme günü arasında cari modülü ≠ defter — değişmez hata saymaz; sonra eşit
        m = self._model([o("taksit_excel", "2026-02-10", cari="C1", toplam=3000, odenen=1000, yukleme_ani="2026-03-09T22:30:00Z",
                           taksitler=[{"vade": "2026-04-01", "tutar": 3000}])])
        d = m.canli
        self.assertEqual(d.moduller("2026-03-01").get(("cari", "C1")), 2000)
        self.assertEqual(d.bakiyeler("2026-03-01").get(("120", "C1"), 0), 0)
        self.assertEqual(M.modul_defter_farki(d, "2026-03-01"), [])
        self.assertEqual(M.modul_defter_farki(d, "2026-03-10"), [])
        d.fis_ekle("2026-02-20", 1, "x", [M.Bo("120", 50, "C1"), M.Al("500", 50)])   # dişi: pencerede başka fark yine yakalanır
        self.assertTrue(M.modul_defter_farki(d, "2026-03-01"))

    def test_B14_yalniz_alt_defter_red_ve_kesisen_susar(self):
        # W18: fark yalnız alt defterde (S14 120 ↔ 128) → fiş yazılmaz, KURAL_FARKI_ALT_DEFTER
        temel = [o("satis_faturasi", "2026-02-01", id="F1", cari="C1", M=10000, K=0), o("supheliye_al", "2026-03-01", id="SA1", cari="C1", tutar=10000)]
        cek = o("tahsilat", "2026-03-10", id="P1", cari="C1", yol="cek", evrak="CK1", tutar=4000, fatura="F1")
        kilit = [o("donem_kilitle", tarih="2026-03-31", kural="2.4.9"), o("kural_farki_duzelt")]
        m = self._model(temel + [cek] + kilit)
        self.assertEqual([x["kod"] for x in m.redler], ["KURAL_FARKI_ALT_DEFTER"])
        self.assertEqual([f for f in m.canli.fisler if f.tur == "kural_farki"], [])
        # W19: karşılık çözülmesi (B 129 / A 644) yalnız güncel kuralda → fark alt defter ile alt defter dışı arasında → kâhin susar
        with self.assertRaises(AssertionError):
            self._model(temel + [o("karsilik_ayir", "2026-03-05", cari="C1", kayit="SA1", tutar=8000), cek] + kilit)

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

    def test_pos_valoru_belirsiz_gune_dusmez(self):
        # kâhin bakımı 4 (S21 A; README Y21, Y23; bakım 3'ün test_pos_valoru_resmi_tatile_dusmez'inin YERİNE): sabit resmî tatile düşen valör artık
        # SERBEST (model sonraki iş gününe kaydırır); valör, hafta sonu kaydırmasının geçtiği günler ve modelin kaydırma yolu BELİRSİZ güne (yarım gün /
        # doğrulanmamış dinî bayram) düşmez — kâhin orada kural kurmaz. En az bir senaryoda valör sabit tatile düşer (S21 sınanır)
        import datetime as dt
        n = tatil = 0
        for s in self._hepsi():
            for x in s["olaylar"]:
                if x.get("yol") == "pos" and x.get("valor"):
                    n += 1
                    self.assertTrue(U.valor_kesin(x["tarih"], dt.date.fromisoformat(x["valor"])), f"{s['ad']} {x.get('id')} {x['valor']}")
                    tatil += M.tatil_turu(x["valor"]) == "tam"
        self.assertGreater(n, 10)
        self.assertGreaterEqual(tatil, 4)
        # kâhin bakımı 5 (S27 A, README Z11): 28 Ekim yarım gün artık belirsiz DEĞİL (iş günü); doğrulanmamış dinî bayram belirsiz kalır (Z12)
        self.assertTrue(not U.belirsiz_mi(dt.date(2026, 10, 28)) and U.belirsiz_mi(dt.date(2026, 5, 27)) and not U.belirsiz_mi(dt.date(2026, 4, 23)))


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
