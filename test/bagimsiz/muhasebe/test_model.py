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
        self.assertEqual(M.Kurallar.etiketten("KG6=B,KG3=SORU").etiket(), "KG3=SORU,KG6=B")
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
        yev, _ = yevmiye([o("alis_faturasi", "2026-05-02", cari="T2", fatura_turu="gider", M=1000000, S=200000)])
        self.assertEqual(satirlar(yev[0]), {"770": 1000000, "320|T2": -800000, "360": -200000})

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
        yev, _ = yevmiye([o("satis_faturasi", "2026-01-10", cari="C1", M=1000), o("supheliye_al", "2026-02-01", cari="C1", tutar=800),
                          o("karsilik_ayir", "2026-02-02", cari="C1", tutar=600),
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
        ols = [o("satis_faturasi", "2026-12-15", id="F1", cari="C1", M=1000, vade="2027-01-15"), o("devir", K="2026-12-31"),
               E.R("yev", "yevmiye", bas="2027-01-01", son="2027-01-01")]
        r = M.kos(senaryo(ols))
        self.assertEqual([satirlar(m) for m in r["raporlar"]["yev"]], [{"120|C1": 1000, "519": -1000}, {"590": -1000, "519": 1000}])
        self.assertEqual(r["raporlar"]["yev"][0]["satirlar"][0]["e"]["vade"], "2027-01-15")

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

    def test_tumu_tuttu(self):
        self.assertTrue(M.tumu_tuttu({"a": [], "b": {"c": []}}))
        self.assertFalse(M.tumu_tuttu({"a": [], "b": {"c": [1]}}))


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
