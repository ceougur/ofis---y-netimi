#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""e-Belge kâhin modelinin kendi birim testleri (python3 test/bagimsiz/ebelge/test_model.py).

Beklenen değerler KARARLAR.md'deki kurallardan elle yazıldı (her testte K-numarası); programdan ya da onun testlerinden alınmadı.
mutasyon.py bu testleri bilerek bozulmuş modele karşı koşar (testin dişi).
"""

import os
import random
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import model as M  # noqa: E402

CARILER = {"K1": "kisi", "K2": "mukellef", "K3": "mukellef_pksiz", "K4": "gizli_mukellef", "K5": "kisi",
           "K6": "ilsiz_kisi", "K7": "vdsiz_mukellef", "K8": "nihai"}


def senaryo(adimlar, bugun="2026-06-17"):
    return {"dil": M.DIL, "ad": "birim", "bugun": bugun, "cariler": dict(CARILER),
            "adimlar": [dict(a, no=i + 1) for i, a in enumerate(adimlar)]}


def kos(adimlar, bugun="2026-06-17", sec=None, ux15=True):
    """Modeli koşar; her adımda ilk aday (ya da sec(adaylar) ile seçilen) alınır. Son dünya ve son adım adayları döner."""
    m = M.Model(senaryo(adimlar, bugun), ux15=ux15)
    for a in m.senaryo["adimlar"]:
        m.adim(a)
        if sec:
            m.dunyalar = [sec(m.adaylar, a)]
        else:
            m.sec()
    return m.dunyalar[0], m.adaylar


def K(ad, cari, tarih, gonder="sonra", **ek):
    return {"islem": "kaydet", "belge": ad, "cari": cari, "tarih": tarih, "gonder": gonder, **ek}


def S(ad, cari, tarih, gonder="sonra"):
    """e-SMM makbuzu (K34)."""
    return K(ad, cari, tarih, gonder, belge_turu="esmm")


def G(n):
    return {"islem": "gun_ilerlet", "gun": n}


def SEC(belgeler, eski):
    return {"islem": "tumunu_gonder", "kapsam": "secili", "belgeler": belgeler, "eski": eski}


T = {"islem": "tumunu_gonder", "kapsam": "hepsi"}


def no(d, ad):
    return d.belgeler[ad].get("numara")


class Numara(unittest.TestCase):
    def test_tumunu_gonder_eskiden_yeniye_K10(self):
        d, _ = kos([K("B1", "K1", "2026-06-17"), K("B2", "K1", "2026-06-15"), K("B3", "K5", "2026-06-16"), T])
        self.assertEqual((no(d, "B2"), no(d, "B3"), no(d, "B1")), ("TEA2026000000001", "TEA2026000000002", "TEA2026000000003"))
        self.assertTrue(all(d.belgeler[x]["edm"] and d.belgeler[x]["prog"] for x in ("B1", "B2", "B3")))

    def test_ayni_tarihte_yazim_sirasi_K10(self):
        d, _ = kos([K("B1", "K1", "2026-06-16"), K("B2", "K5", "2026-06-16"), T])
        self.assertEqual((no(d, "B1"), no(d, "B2")), ("TEA2026000000001", "TEA2026000000002"))

    def test_iki_seri_ayri_K4(self):
        d, _ = kos([K("B1", "K2", "2026-06-17"), K("B2", "K1", "2026-06-17"), K("B3", "K2", "2026-06-17"), T])
        self.assertEqual((no(d, "B1"), no(d, "B2"), no(d, "B3")), ("TEF2026000000001", "TEA2026000000001", "TEF2026000000002"))

    def test_yil_basinda_sira_1den_K5(self):
        d, _ = kos([K("B1", "K1", "2026-12-30"), T, {"islem": "gun_ilerlet", "gun": 3}, K("B2", "K1", "2027-01-02"),
                    K("B3", "K5", "2026-12-31"), T], bugun="2026-12-30")
        self.assertEqual((no(d, "B1"), no(d, "B3"), no(d, "B2")), ("TEA2026000000001", "TEA2026000000002", "TEA2027000000001"))

    def test_bicim_K5(self):
        self.assertEqual(M.numara("TEF", 2026, 12), "TEF2026000000012")
        self.assertEqual(M.coz_numara("TEA2027000000003"), ("TEA", 2027, 3))
        self.assertIsNone(M.coz_numara("TEA27-3"))


class TarihSirasi(unittest.TestCase):
    def test_eski_tarihli_bekleyen_gonderilemez_ve_bekletmez_K6_K9(self):
        d, _ = kos([K("B1", "K1", "2026-06-17", "simdi"), K("B2", "K1", "2026-06-10"), T, K("B3", "K5", "2026-06-17"), T], ux15=False)
        self.assertEqual(no(d, "B2"), "")
        self.assertFalse(d.belgeler["B2"]["edm"])
        self.assertTrue(d.bekleyen(d.belgeler["B2"]))
        self.assertEqual(no(d, "B3"), "TEA2026000000002")

    def test_sonra_kaydi_tarih_sirasina_uymazsa_catal_K29(self):
        _, adaylar = kos([K("B1", "K1", "2026-06-17", "simdi"), K("B2", "K1", "2026-06-10")], ux15=False)
        self.assertEqual(sorted(str(a.belgeler["B2"]["var"]) for a in adaylar), ["False", "True"])


class Bekletme(unittest.TestCase):
    def test_kaydet_ve_gonder_eski_bekleyen_varken_numarasiz_K8(self):
        d, _ = kos([K("B1", "K1", "2026-06-15"), K("B2", "K5", "2026-06-17", "simdi")])
        self.assertEqual(no(d, "B2"), "")
        self.assertTrue(d.bekleyen(d.belgeler["B2"]))
        self.assertFalse(d.belgeler["B2"]["edm"])

    def test_kartta_gonder_eski_bekleyen_varken_numarasiz_K8(self):
        d, _ = kos([K("B1", "K1", "2026-06-15"), K("B2", "K5", "2026-06-17"), {"islem": "kart_gonder", "belge": "B2"}])
        self.assertEqual(no(d, "B2"), "")

    def test_ayni_tarihli_bekleyen_bekletmez_K8(self):
        d, _ = kos([K("B1", "K1", "2026-06-17"), K("B2", "K5", "2026-06-17", "simdi")])
        self.assertEqual(no(d, "B2"), "TEA2026000000001")

    def test_baska_seri_bekletmez_K8(self):
        d, _ = kos([K("B1", "K2", "2026-06-15"), K("B2", "K1", "2026-06-17", "simdi")])
        self.assertEqual(no(d, "B2"), "TEA2026000000001")

    def test_onceki_yil_bekletmez_K8(self):
        d, _ = kos([K("B1", "K1", "2026-12-31"), {"islem": "gun_ilerlet", "gun": 2}, K("B2", "K1", "2027-01-02", "simdi")], bugun="2026-12-31")
        self.assertEqual(no(d, "B2"), "TEA2027000000001")

    def test_pk_yok_gecici_engel_bekletir_K2_K9(self):
        # baş mimar kararı 18.10.2026: posta kutusu seçilmemiş e-Fatura GEÇİCİ engeldir, aynı serideki yeni belgeyi bekletir.
        d, _ = kos([K("B1", "K3", "2026-06-15"), K("B2", "K2", "2026-06-17", "simdi")])
        self.assertEqual(no(d, "B2"), "")
        self.assertTrue(d.bekleyen(d.belgeler["B2"]))
        d, _ = kos([K("B1", "K3", "2026-06-15"), K("B2", "K2", "2026-06-17"), T])
        self.assertEqual((no(d, "B1"), no(d, "B2")), ("", ""))
        self.assertFalse(d.belgeler["B1"]["edm"] or d.belgeler["B2"]["edm"])
        # başka seriyi (e-Arşiv) bekletmez; aynı tarihli belgeyi bekletmez
        d, _ = kos([K("B1", "K3", "2026-06-15"), K("B2", "K1", "2026-06-17", "simdi"), K("B3", "K2", "2026-06-15", "simdi")])
        self.assertEqual((no(d, "B2"), no(d, "B3")), ("TEA2026000000001", "TEF2026000000001"))

    def test_pk_yok_tarih_engelliyse_bekletmez_K6_K9(self):
        d, _ = kos([K("B1", "K2", "2026-06-16", "simdi"), K("B2", "K3", "2026-06-15"), K("B3", "K2", "2026-06-17", "simdi")], ux15=False)
        self.assertEqual((no(d, "B2"), no(d, "B3")), ("", "TEF2026000000002"))

    def test_alici_mukellef_eArsiv_bekletmez_gitmez_K3_K9(self):
        d, _ = kos([K("B1", "K4", "2026-06-15"), K("B2", "K1", "2026-06-17", "simdi"), T])
        self.assertEqual((no(d, "B1"), no(d, "B2")), ("", "TEA2026000000001"))
        self.assertFalse(d.belgeler["B1"]["edm"])

    def test_listeden_silinen_bekletmez_K9(self):
        d, _ = kos([K("B1", "K1", "2026-06-15"), {"islem": "listeden_sil", "belge": "B1"}, K("B2", "K1", "2026-06-17", "simdi")])
        self.assertEqual(no(d, "B2"), "TEA2026000000001")

    def test_secili_turda_secilmeyen_eski_bekletir_K8(self):
        d, _ = kos([K("B1", "K1", "2026-06-15"), K("B2", "K1", "2026-06-17"), {"islem": "tumunu_gonder", "kapsam": "secili", "belgeler": ["B2"]}])
        self.assertEqual((no(d, "B1"), no(d, "B2")), ("", ""))
        d, _ = kos([K("B1", "K1", "2026-06-15"), K("B2", "K1", "2026-06-17"), {"islem": "tumunu_gonder", "kapsam": "secili", "belgeler": ["B1"]}])
        self.assertEqual((no(d, "B1"), no(d, "B2")), ("TEA2026000000001", ""))


class Ag(unittest.TestCase):
    def test_ag_yokken_numara_yok_tur_durur_K12(self):
        d, _ = kos([{"islem": "ag", "durum": "yok"}, K("B1", "K1", "2026-06-16", "simdi"), K("B2", "K2", "2026-06-17"), T,
                    {"islem": "kart_gonder", "belge": "B2"}])
        self.assertEqual((no(d, "B1"), no(d, "B2")), ("", ""))
        self.assertTrue(d.bekleyen(d.belgeler["B1"]))
        d, _ = kos([{"islem": "ag", "durum": "yok"}, K("B1", "K1", "2026-06-16", "simdi"), K("B2", "K2", "2026-06-17"), T,
                    {"islem": "ag", "durum": "var"}, T])
        self.assertEqual((no(d, "B1"), no(d, "B2")), ("TEA2026000000001", "TEF2026000000001"))


class Silme(unittest.TestCase):
    def test_listeden_silinen_turda_gitmez_kartta_gider_K7_K18(self):
        d, _ = kos([K("B1", "K1", "2026-06-17"), {"islem": "listeden_sil", "belge": "B1"}, T])
        self.assertFalse(d.belgeler["B1"]["edm"])
        self.assertFalse(d.bekleyen(d.belgeler["B1"]))
        d, _ = kos([K("B1", "K1", "2026-06-17"), {"islem": "listeden_sil", "belge": "B1"}, {"islem": "kart_gonder", "belge": "B1"}])
        self.assertTrue(d.belgeler["B1"]["edm"])
        self.assertEqual(no(d, "B1"), "TEA2026000000001")

    def test_listeden_sil_fis_sirasini_korur_K31(self):
        kg = lambda ad, t: {"islem": "kagit_kaydet", "belge": ad, "cari": "K1", "tarih": t}  # noqa: E731
        d, _ = kos([kg("B1", "2026-06-17"), K("B2", "K1", "2026-06-15"), {"islem": "listeden_sil", "belge": "B2"}, T])
        self.assertEqual(d.belgeler["B2"]["silindi"], False)
        self.assertEqual(no(d, "B2"), "TEA2026000000001")  # reddedilen silme sonrası Gönderilecekler'de kaldı ve gitti
        d, _ = kos([kg("B1", "2026-06-17"), K("B2", "K1", "2026-06-15"), {"islem": "listeden_sil", "belge": "B2"}])
        self.assertEqual((d.yanit, no(d, "B2"), d.bekleyen(d.belgeler["B2"])), ("4xx", "", True))
        d, _ = kos([kg("B1", "2026-06-16"), K("B2", "K1", "2026-06-16"), {"islem": "listeden_sil", "belge": "B2"}])
        self.assertEqual((d.yanit, d.belgeler["B2"]["silindi"]), ("2xx", True))  # aynı tarih sırayı bozmaz
        _, adaylar = kos([kg("B1", "2026-06-17"), K("B2", "K1", "2026-06-15"), K("B3", "K1", "2026-06-16"),
                          {"islem": "tur_sirasinda_sil", "belge": "B3"}])
        self.assertTrue(all(a.yanit != "2xx" for a in adaylar))

    def test_gonderilmis_listeden_silinmez_K20(self):
        d, _ = kos([K("B1", "K1", "2026-06-17", "simdi"), {"islem": "listeden_sil", "belge": "B1"}])
        self.assertEqual(d.yanit, "4xx")
        self.assertFalse(d.belgeler["B1"]["silindi"])

    def test_tur_sirasinda_silinen_seriyi_bekletmez_K15_K9_A7(self):
        # A7 (tohum 2 × 150 adım 61): turun ilk belgesi B1 (e-Arşiv) giderken B2 (e-Fatura) silinir → aynı turdaki daha yeni e-Fatura B3 numara alır.
        _, adaylar = kos([K("B1", "K1", "2026-06-15"), K("B2", "K2", "2026-06-15"), K("B3", "K2", "2026-06-17"), {"islem": "tur_sirasinda_sil", "belge": "B2"}])
        kabul = [a for a in adaylar if a.yanit == "2xx"]
        self.assertTrue(kabul)
        for a in kabul:
            self.assertEqual((a.belgeler["B2"]["edm"], no(a, "B3")), (False, "TEF2026000000001"))

    def test_tur_sirasinda_silinen_gitmez_K15(self):
        _, adaylar = kos([K("B1", "K1", "2026-06-15"), K("B2", "K5", "2026-06-17"), {"islem": "tur_sirasinda_sil", "belge": "B2"}])
        kabul = [a for a in adaylar if a.yanit == "2xx"]
        self.assertTrue(kabul)
        for a in kabul:
            self.assertFalse(a.belgeler["B2"]["edm"])
            self.assertTrue(a.belgeler["B1"]["edm"])
        # turun ilk gönderilen belgesi silinemez (silme kabul edilen dünya yok)
        _, adaylar = kos([K("B1", "K1", "2026-06-15"), K("B2", "K5", "2026-06-17"), {"islem": "tur_sirasinda_sil", "belge": "B1"}])
        self.assertFalse([a for a in adaylar if a.yanit == "2xx" and a.belgeler["B1"]["edm"]])


class IptalDuzenle(unittest.TestCase):
    def test_iptal_edilen_numara_almaz_gitmez_K24(self):
        d, _ = kos([K("B1", "K1", "2026-06-17"), {"islem": "iptal", "belge": "B1"}, T])
        self.assertEqual(no(d, "B1"), "")
        self.assertFalse(d.belgeler["B1"]["edm"])
        self.assertTrue(d.belgeler["B1"]["iptal"])

    def test_gonderilmis_eArsiv_8_gun_icinde_iptal_numara_korunur_K22(self):
        d, _ = kos([K("B1", "K1", "2026-06-17", "simdi"), {"islem": "gun_ilerlet", "gun": 3}, {"islem": "iptal", "belge": "B1"}])
        self.assertTrue(d.belgeler["B1"]["iptal"])
        self.assertEqual(no(d, "B1"), "TEA2026000000001")
        d, _ = kos([K("B1", "K1", "2026-06-17", "simdi"), {"islem": "iptal", "belge": "B1"}, K("B2", "K1", "2026-06-17", "simdi")])
        self.assertEqual(no(d, "B2"), "TEA2026000000002")

    def test_gonderilmis_eArsiv_ag_yokken_iptal_5xx_K23(self):
        _, adaylar = kos([K("B1", "K1", "2026-06-17", "simdi"), {"islem": "ag", "durum": "yok"}, {"islem": "iptal", "belge": "B1"}])
        self.assertTrue(any(a.yanit == "5xx" and not a.belgeler["B1"]["iptal"] for a in adaylar))

    def test_gonderilmis_eFatura_iptali_catal_K23(self):
        _, adaylar = kos([K("B1", "K2", "2026-06-17", "simdi"), {"islem": "iptal", "belge": "B1"}])
        self.assertEqual(len(adaylar), 2)

    def test_gonderilmis_belge_duzenlenmez_K25_K27(self):
        d, _ = kos([K("B1", "K1", "2026-06-17", "simdi"), {"islem": "duzenle_tarih", "belge": "B1", "tarih": "2026-06-16"}])
        self.assertEqual(d.yanit, "4xx")
        self.assertEqual(d.belgeler["B1"]["tarih"], "2026-06-17")
        d, _ = kos([K("B1", "K1", "2026-06-17", "simdi"), {"islem": "duzenle_tur", "belge": "B1", "profil": "TEMELFATURA"}])
        self.assertEqual(d.yanit, "4xx")

    def test_numarasiz_belgenin_tarihi_duzenlenir(self):
        d, _ = kos([K("B1", "K1", "2026-06-17"), {"islem": "duzenle_tarih", "belge": "B1", "tarih": "2026-06-12"}, T])
        self.assertEqual(d.belgeler["B1"]["tarih"], "2026-06-12")
        self.assertEqual(no(d, "B1"), "TEA2026000000001")

    def test_ileri_tarih_reddedilir_K16(self):
        d, _ = kos([K("B1", "K1", "2026-06-18")])
        self.assertEqual(d.yanit, "4xx")
        self.assertFalse(d.belgeler["B1"]["var"])
        d, _ = kos([K("B1", "K1", "2026-06-17"), {"islem": "duzenle_tarih", "belge": "B1", "tarih": "2026-06-18"}])
        self.assertEqual(d.yanit, "4xx")

    def test_cari_isareti_degisince_tur_korunmaz_K30(self):
        m = M.Model(senaryo([K("B1", "K4", "2026-06-17"), {"islem": "duzenle_tarih", "belge": "B1", "tarih": "2026-06-16"}]))
        m.adim(m.senaryo["adimlar"][0])
        m.sec()
        m.dunyalar[0].cariler["K4"]["isaret"] = True  # program Mükellef Sorgula/gönderim sorgusuyla işaretledi (ortam)
        m.adim(m.senaryo["adimlar"][1])
        self.assertEqual(m.sec().yanit, "4xx")


class IptalSuresi(unittest.TestCase):
    """K22 (düzeltildi): [GİB] Kılavuz V.1.1 §3 + [KULLANICI] KARARLAR (5) — iletimden 8 gün, başlangıç günü sayılmaz, 8. gün dahil."""

    def test_iletimden_8_gun_dahil_9_red_K22(self):
        for kur in (K, S):
            d, _ = kos([kur("B1", "K1", "2026-06-17", "simdi"), G(8), {"islem": "iptal", "belge": "B1"}])
            self.assertEqual((d.yanit, d.belgeler["B1"]["iptal"], d.belgeler["B1"]["edm_iptal"]), ("2xx", True, True), kur.__name__)
            d, adaylar = kos([kur("B1", "K1", "2026-06-17", "simdi"), G(9), {"islem": "iptal", "belge": "B1"}])
            self.assertEqual(len(adaylar), 1)
            self.assertEqual((d.yanit, d.belgeler["B1"]["iptal"], d.belgeler["B1"]["edm_iptal"]), ("4xx", False, False), kur.__name__)

    def test_sure_kesimden_degil_iletimden_K22(self):
        # 10.06'da kesilip 17.06'da gönderilen e-Arşiv: 25.06 (iletimden 8. gün, kesimden 15. gün) iptal edilir — eski "kesimden ≤7" yanlıştı.
        d, _ = kos([K("B1", "K1", "2026-06-10"), T, G(8), {"islem": "iptal", "belge": "B1"}])
        self.assertEqual((d.yanit, d.belgeler["B1"]["edm_iptal"]), ("2xx", True))

    def test_sure_dolunca_yalniz_programda_iptal_de_red_K22(self):
        for kur in (K, S):
            d, adaylar = kos([kur("B1", "K1", "2026-06-17", "simdi"), G(9), {"islem": "iptal", "belge": "B1", "yerel": True}])
            self.assertEqual((len(adaylar), d.yanit, d.belgeler["B1"]["iptal"]), (1, "4xx", False), kur.__name__)

    def test_gonderilmemis_belge_sure_disinda_da_iptal_K24(self):
        d, _ = kos([K("B1", "K1", "2026-06-17"), G(20), {"islem": "iptal", "belge": "B1"}])
        self.assertEqual((d.yanit, d.belgeler["B1"]["iptal"]), ("2xx", True))


class BelirsizYerelIptal(unittest.TestCase):
    """K35 ([KULLANICI] 22.10.2026): belirsiz belgede 8 gün sonra Yalnız Programda İptal önce EDM'ye sorar."""

    def sec_edm(self, edm):
        return lambda ad, a: next((x for x in ad if x.belgeler.get("B1", {}).get("edm") is edm and x.belgeler["B1"].get("belirsiz")), ad[0])

    def test_edmde_var_red_edmde_yok_serbest_K35(self):
        for edm, beklenen in ((True, ("4xx", False)), (False, ("2xx", True))):
            d, _ = kos([{"islem": "ariza", "tur": "kopma_sonra"}, K("B1", "K1", "2026-06-17", "simdi"), G(9), {"islem": "iptal", "belge": "B1", "yerel": True}],
                       sec=lambda ad, a, e=edm: next((x for x in ad if x.belgeler.get("B1", {}).get("edm") is e and x.belgeler["B1"].get("belirsiz")), ad[0]) if a["islem"] == "kaydet" else ad[0])
            self.assertTrue(d.belgeler["B1"]["numara"])
            self.assertEqual((d.yanit, d.belgeler["B1"]["iptal"]), beklenen, f"edm={edm}")
            self.assertFalse(d.belgeler["B1"]["edm_iptal"])

    def test_sorgu_edmde_bulursa_gonderildi_K35_K28(self):
        d, _ = kos([{"islem": "ariza", "tur": "kopma_sonra"}, K("B1", "K1", "2026-06-17", "simdi"), G(9), {"islem": "iptal", "belge": "B1", "yerel": True}],
                   sec=lambda ad, a: next((x for x in ad if x.belgeler.get("B1", {}).get("edm") is True and x.belgeler["B1"].get("belirsiz")), ad[0]) if a["islem"] == "kaydet" else ad[0])
        self.assertEqual((d.yanit, d.belgeler["B1"]["prog"], d.belgeler["B1"]["iptal"]), ("4xx", True, False))

    def test_esmm_belirsiz_yeniden_gonderilmeyebilir_K14_incele(self):
        sec = lambda ad, a: next((x for x in ad if x.belgeler.get("B1", {}).get("edm") is False and x.belgeler["B1"].get("belirsiz")), ad[0]) if a["islem"] == "kaydet" else ad[0]  # noqa: E731
        _, adaylar = kos([{"islem": "ariza", "tur": "kopma_once"}, S("B1", "K1", "2026-06-17", "simdi"), T], sec=sec)
        self.assertEqual(sorted((a.belgeler["B1"]["edm"], tuple(a.incele)) for a in adaylar), [(False, ("K14-ESMM-BELIRSIZ-KALIR",)), (True, ())])

    def test_ag_yokken_5xx_K35(self):
        d, _ = kos([{"islem": "ariza", "tur": "kopma_sonra"}, K("B1", "K1", "2026-06-17", "simdi"), G(9), {"islem": "ag", "durum": "yok"},
                    {"islem": "iptal", "belge": "B1", "yerel": True}],
                   sec=lambda ad, a: next((x for x in ad if x.belgeler.get("B1", {}).get("belirsiz")), ad[0]))
        self.assertEqual((d.yanit, d.belgeler["B1"]["iptal"]), ("5xx", False))

    def test_esmm_bulunamadi_yerel_iptal_K35_K41b(self):
        # K41b ([KULLANICI] 23.10.2026 01:26 UTC): e-SMM'de de EDM "bulunamadı" → yalnız programda iptal (tur 2'deki İNCELE çatalı kalktı)
        _, adaylar = kos([{"islem": "ariza", "tur": "kopma_sonra"}, S("B1", "K1", "2026-06-17", "simdi"), G(9), {"islem": "iptal", "belge": "B1", "yerel": True}],
                         sec=lambda ad, a: next((x for x in ad if x.belgeler.get("B1", {}).get("edm") is False and x.belgeler["B1"].get("belirsiz")), ad[0]) if a["islem"] == "kaydet" else ad[0])
        self.assertEqual([(a.yanit, a.belgeler["B1"]["iptal"], tuple(a.incele)) for a in adaylar], [("2xx", True, ())])

    def test_efatura_belirsiz_ayni_kural_K41b(self):
        # K41b: belirsiz e-Fatura (K2) — 8. gün dahil yerel iptal (EDM'ye sorulmaz); 9. gün EDM'de var → 409 ve gönderildi; yok → iptal; ağ yok → 5xx
        def kur(edm, gun, ag=True):
            adim = [{"islem": "ariza", "tur": "kopma_sonra" if edm else "kopma_once"}, K("B1", "K2", "2026-06-17", "simdi"), G(gun)]
            if not ag:
                adim.append({"islem": "ag", "durum": "yok"})
            sec = lambda ad, a, e=edm: next((x for x in ad if x.belgeler.get("B1", {}).get("edm") is e and x.belgeler["B1"].get("belirsiz")), ad[0]) if a["islem"] == "kaydet" else ad[0]  # noqa: E731
            return kos(adim + [{"islem": "iptal", "belge": "B1", "yerel": True}], sec=sec)
        for edm in (True, False):
            d, adaylar = kur(edm, 8)
            self.assertEqual((len(adaylar), d.yanit, d.belgeler["B1"]["iptal"], d.belgeler["B1"]["edm_iptal"]), (1, "2xx", True, False), f"8. gün edm={edm}")
        d, adaylar = kur(True, 9)
        self.assertEqual((len(adaylar), d.yanit, d.belgeler["B1"]["iptal"], d.belgeler["B1"]["prog"]), (1, "4xx", False, True))
        d, adaylar = kur(False, 9)
        self.assertEqual((len(adaylar), d.yanit, d.belgeler["B1"]["iptal"]), (1, "2xx", True))
        d, adaylar = kur(True, 9, ag=False)
        self.assertEqual((len(adaylar), d.yanit, d.belgeler["B1"]["iptal"]), (1, "5xx", False))
        # e-Faturanın olağan iptali değişmez (gönderilmiş e-Fatura: K23 çatalı; yerel iptal gönderilmişte red — K41)
        _, adaylar = kos([K("B1", "K2", "2026-06-17", "simdi"), G(9), {"islem": "iptal", "belge": "B1"}])
        self.assertEqual(sorted(a.yanit or "-" for a in adaylar), ["-", "4xx"])
        d, adaylar = kos([K("B1", "K2", "2026-06-17", "simdi"), G(2), {"islem": "iptal", "belge": "B1", "yerel": True}])
        self.assertEqual((len(adaylar), d.yanit, d.belgeler["B1"]["iptal"]), (1, "4xx", False))

    def test_belirsizde_olagan_iptal_once_durum_sorgula(self):
        _, adaylar = kos([{"islem": "ariza", "tur": "kopma_sonra"}, K("B1", "K1", "2026-06-17", "simdi"), {"islem": "iptal", "belge": "B1"}],
                         sec=lambda ad, a: next((x for x in ad if x.belgeler.get("B1", {}).get("belirsiz")), ad[0]) if a["islem"] == "kaydet" else ad[0])
        self.assertIn("4xx", [a.yanit for a in adaylar])


class SecilenleriGonder(unittest.TestCase):
    """K33 ([KULLANICI] 19.10.2026; K6/K8/K9)."""

    def test_eski_bekleyen_varken_soru_numara_yok_K33(self):
        d, _ = kos([K("B1", "K1", "2026-06-15"), K("B2", "K5", "2026-06-17"), SEC(["B2"], "vazgec")])
        self.assertEqual((d.yanit, d.k33, no(d, "B1"), no(d, "B2")), ("4xx", ["B1"], "", ""))
        self.assertFalse(d.belgeler["B2"]["edm"])

    def test_ekle_eskiden_yeniye_gonderir_K33_K10(self):
        d, _ = kos([K("B1", "K1", "2026-06-15"), K("B2", "K5", "2026-06-17"), K("B3", "K1", "2026-06-16"), SEC(["B2"], "ekle")])
        self.assertEqual((d.yanit, sorted(d.k33)), ("2xx", ["B1", "B3"]))
        self.assertEqual((no(d, "B1"), no(d, "B3"), no(d, "B2")), ("TEA2026000000001", "TEA2026000000002", "TEA2026000000003"))

    def test_ayni_gun_baska_seri_kalici_engel_sormaz_K33(self):
        d, _ = kos([K("B1", "K1", "2026-06-17"), K("B2", "K5", "2026-06-17"), SEC(["B2"], "vazgec")])  # aynı gün
        self.assertEqual((d.k33, no(d, "B2")), ([], "TEA2026000000001"))
        d, _ = kos([K("B1", "K2", "2026-06-15"), K("B2", "K5", "2026-06-17"), SEC(["B2"], "vazgec")])  # başka seri
        self.assertEqual((d.k33, no(d, "B2")), ([], "TEA2026000000001"))
        d, _ = kos([K("B1", "K4", "2026-06-15"), T, K("B2", "K5", "2026-06-17"), SEC(["B2"], "vazgec")])  # alıcı mükellef (kalıcı, öğrenilmiş)
        self.assertEqual((d.k33, no(d, "B2")), ([], "TEA2026000000001"))
        d, _ = kos([K("B1", "K1", "2026-06-16", "simdi"), K("B2", "K1", "2026-06-12"), K("B3", "K5", "2026-06-17"), SEC(["B3"], "vazgec")], ux15=False)
        self.assertEqual((d.k33, no(d, "B3")), ([], "TEA2026000000002"))  # tarih sırası engelli eski (K6, kalıcı) sorulmaz
        d, _ = kos([K("B1", "K1", "2026-06-15"), {"islem": "listeden_sil", "belge": "B1"}, K("B2", "K5", "2026-06-17"), SEC(["B2"], "vazgec")])
        self.assertEqual((d.k33, no(d, "B2")), ([], "TEA2026000000001"))

    def test_gecici_engelli_pk_yok_sorar_K33_K9(self):
        d, _ = kos([K("B1", "K3", "2026-06-15"), K("B2", "K2", "2026-06-17"), SEC(["B2"], "vazgec")])
        self.assertEqual((d.yanit, d.k33, no(d, "B2")), ("4xx", ["B1"], ""))

    def test_alici_mukellef_yalniz_ogrenilince_kalici_K33_K3(self):
        # Program alıcının mükellef olduğunu ancak gönderimde öğrenir; ön soru EDM'ye gitmez → denenmemiş belge sorulur, denenmiş sorulmaz.
        d, _ = kos([K("B1", "K4", "2026-06-15"), K("B2", "K5", "2026-06-17"), SEC(["B2"], "vazgec")])
        self.assertEqual((d.yanit, d.k33), ("4xx", ["B1"]))
        d, _ = kos([K("B1", "K4", "2026-06-15"), {"islem": "kart_gonder", "belge": "B1"}, K("B2", "K5", "2026-06-17"), SEC(["B2"], "vazgec")])
        self.assertEqual((d.k33, no(d, "B2")), ([], "TEA2026000000001"))

    def test_numarali_eski_sormaz_K33(self):
        sec = lambda ad, a: next((x for x in ad if x.belgeler.get("B1", {}).get("hata")), ad[0])  # noqa: E731
        d, _ = kos([{"islem": "ariza", "tur": "gecici_hata"}, K("B1", "K1", "2026-06-15", "simdi"), K("B2", "K5", "2026-06-17"), SEC(["B2"], "vazgec")], sec=sec)
        self.assertEqual(no(d, "B1"), "TEA2026000000001")
        self.assertEqual((d.k33, no(d, "B2")), ([], "TEA2026000000002"))


class ESmm(unittest.TestCase):
    """K34: e-SMM (ESMM) seri TES, TEA/TEF'ten bağımsız; numara sırası = tarih sırası (K6/K8)."""

    def test_seri_ve_tarih_sirasi_K34(self):
        d, _ = kos([S("B1", "K1", "2026-06-17"), S("B2", "K2", "2026-06-15"), S("B3", "K5", "2026-06-16"), K("B4", "K1", "2026-06-16"), T])
        self.assertEqual((no(d, "B2"), no(d, "B3"), no(d, "B1"), no(d, "B4")),
                         ("TES2026000000001", "TES2026000000002", "TES2026000000003", "TEA2026000000001"))

    def test_esmm_bekletme_seri_ici_K34_K8(self):
        d, _ = kos([S("B1", "K1", "2026-06-15"), S("B2", "K5", "2026-06-17", "simdi"), K("B3", "K1", "2026-06-17", "simdi")])
        self.assertEqual((no(d, "B2"), no(d, "B3")), ("", "TEA2026000000001"))

    def test_esmm_alici_mukellefe_engel_yok_K34(self):
        d, _ = kos([S("B1", "K4", "2026-06-17", "simdi"), S("B2", "K3", "2026-06-17", "simdi")])
        self.assertEqual((no(d, "B1"), no(d, "B2")), ("TES2026000000001", "TES2026000000002"))


class AliciAlanlari(unittest.TestCase):
    """K36: il her e-Belgede; vergi dairesi e-Fatura VKN alıcısında; nihai tüketicide 30.000 TL üstü e-Arşiv."""

    def test_eksik_alici_numara_harcamaz_K36(self):
        for ad, adim in (("ilsiz", K("B1", "K6", "2026-06-17", "simdi")), ("ilsiz-esmm", S("B1", "K6", "2026-06-17", "simdi")),
                         ("vdsiz", K("B1", "K7", "2026-06-17", "simdi")), ("nihai-buyuk", K("B1", "K8", "2026-06-17", "simdi", tutar="buyuk"))):
            d, adaylar = kos([adim, K("B2", "K1", "2026-06-17", "simdi")])
            self.assertEqual(sorted(str(a.belgeler["B1"]["var"]) for a in kos([adim])[1]), ["False", "True"], ad)
            self.assertFalse(d.belgeler["B1"]["var"], ad)
            self.assertIn(no(d, "B2"), ("TEA2026000000001",), ad)
            _, ad2 = kos([adim])
            self.assertTrue(all(not a.belgeler["B1"].get("edm") for a in ad2), ad)

    def test_nihai_olagan_tutar_gider_K36(self):
        d, _ = kos([K("B1", "K8", "2026-06-17", "simdi")])
        self.assertEqual(no(d, "B1"), "TEA2026000000001")


class UX15(unittest.TestCase):
    """K37 ([AJAN] 12 UX15 R1/R2; K6)."""

    def test_R1_son_numaralidan_eski_kayit_reddedilir_sonra_da(self):
        for g in ("sonra", "simdi"):
            d, adaylar = kos([K("B1", "K1", "2026-06-17", "simdi"), K("B2", "K1", "2026-06-10", g)])
            self.assertEqual((len(adaylar), d.yanit, d.belgeler["B2"]["var"]), (1, "4xx", False), g)
        d, _ = kos([K("B1", "K1", "2026-06-17", "simdi"), {"islem": "iptal", "belge": "B1"}, K("B2", "K1", "2026-06-10")])  # iptal dahil
        self.assertFalse(d.belgeler["B2"]["var"])
        d, _ = kos([K("B1", "K1", "2026-06-17", "simdi"), K("B2", "K1", "2026-06-17")])  # aynı gün serbest
        self.assertTrue(d.belgeler["B2"]["var"])

    def test_R2_numarali_belge_komsular_arasinda(self):
        sec = lambda ad, a: next((x for x in ad if x.belgeler.get("B2", {}).get("hata")), ad[0])  # noqa: E731
        once = [K("B1", "K1", "2026-06-10", "simdi"), {"islem": "ariza", "tur": "gecici_hata"}, K("B2", "K1", "2026-06-12", "simdi"), K("B3", "K1", "2026-06-15", "simdi")]
        d, adaylar = kos(once + [{"islem": "duzenle_tarih", "belge": "B2", "tarih": "2026-06-14"}], sec=sec)
        self.assertEqual(no(d, "B2"), "TEA2026000000002")
        self.assertEqual((d.yanit, d.belgeler["B2"]["tarih"]), ("2xx", "2026-06-14"))
        d, _ = kos(once + [{"islem": "duzenle_tarih", "belge": "B2", "tarih": "2026-06-16"}], sec=sec)
        self.assertEqual((d.yanit, d.belgeler["B2"]["tarih"]), ("4xx", "2026-06-12"))
        d, _ = kos(once + [{"islem": "duzenle_tarih", "belge": "B2", "tarih": "2026-06-09"}], sec=sec)
        self.assertEqual(d.yanit, "4xx")

    def test_R2_yil_degismez(self):
        sec = lambda ad, a: next((x for x in ad if x.belgeler.get("B1", {}).get("hata")), ad[0])  # noqa: E731
        d, _ = kos([{"islem": "ariza", "tur": "gecici_hata"}, K("B1", "K1", "2027-01-02", "simdi"), {"islem": "duzenle_tarih", "belge": "B1", "tarih": "2026-12-31"}],
                   bugun="2027-01-03", sec=sec)
        self.assertEqual((d.yanit, d.belgeler["B1"]["tarih"]), ("4xx", "2027-01-02"))

    def test_R2_numarasiz_son_numaralidan_eskiye_alinamaz(self):
        d, adaylar = kos([K("B1", "K1", "2026-06-15", "simdi"), K("B2", "K1", "2026-06-17"), {"islem": "duzenle_tarih", "belge": "B2", "tarih": "2026-06-12"}])
        self.assertEqual((len(adaylar), d.yanit, d.belgeler["B2"]["tarih"]), (1, "4xx", "2026-06-17"))


class Arizalar(unittest.TestCase):
    def test_gecici_hata_catallari_K13(self):
        _, adaylar = kos([{"islem": "ariza", "tur": "gecici_hata"}, K("B1", "K1", "2026-06-17", "simdi")])
        durumlar = sorted((a.belgeler["B1"]["numara"], a.belgeler["B1"]["edm"]) for a in adaylar)
        self.assertEqual(durumlar, [("", False), ("TEA2026000000001", False), ("TEA2026000000001", True)])

    def test_gecici_hata_numara_korunursa_ayni_numarayla_gider_K13(self):
        sec = lambda ad, a: next((x for x in ad if x.belgeler.get("B1", {}).get("hata")), ad[0])  # noqa: E731
        d, _ = kos([{"islem": "ariza", "tur": "gecici_hata"}, K("B1", "K1", "2026-06-16", "simdi"), K("B2", "K1", "2026-06-17", "simdi"), T], sec=sec)
        self.assertEqual((no(d, "B1"), no(d, "B2")), ("TEA2026000000001", "TEA2026000000002"))
        self.assertTrue(d.belgeler["B1"]["edm"])

    def test_gecici_hata_numara_birakilirsa_eski_bekletir_K13_K8(self):
        sec = lambda ad, a: next((x for x in ad if x.belgeler.get("B1", {}).get("numara") == ""), ad[0])  # noqa: E731
        d, _ = kos([{"islem": "ariza", "tur": "gecici_hata"}, K("B1", "K1", "2026-06-16", "simdi"), K("B2", "K1", "2026-06-17", "simdi")], sec=sec)
        self.assertEqual((no(d, "B1"), no(d, "B2")), ("", ""))

    def test_kopma_sonra_zaten_gonderildi_hata_degil_K11_K14(self):
        sec = lambda ad, a: next((x for x in ad if x.belgeler.get("B1", {}).get("edm") and not x.belgeler["B1"]["prog"]), ad[0])  # noqa: E731
        d, _ = kos([{"islem": "ariza", "tur": "kopma_sonra"}, K("B1", "K1", "2026-06-17", "simdi")], sec=sec)
        self.assertEqual(no(d, "B1"), "TEA2026000000001")
        self.assertTrue(d.bekleyen(d.belgeler["B1"]))
        d, _ = kos([{"islem": "ariza", "tur": "kopma_sonra"}, K("B1", "K1", "2026-06-17", "simdi"), T], sec=sec)
        self.assertTrue(d.belgeler["B1"]["prog"])
        self.assertEqual(no(d, "B1"), "TEA2026000000001")

    def test_kopmada_edm_varsa_numara_birakilmaz_K14(self):
        _, adaylar = kos([{"islem": "ariza", "tur": "kopma_sonra"}, K("B1", "K1", "2026-06-17", "simdi")])
        for a in adaylar:
            self.assertEqual(no(a, "B1"), "TEA2026000000001")

    def test_durum_sorgula_K28(self):
        sec = lambda ad, a: next((x for x in ad if x.belgeler.get("B1", {}).get("edm") and not x.belgeler["B1"]["prog"]), ad[0])  # noqa: E731
        d, _ = kos([{"islem": "ariza", "tur": "kopma_sonra"}, K("B1", "K1", "2026-06-17", "simdi"), {"islem": "durum_sorgula", "belge": "B1"}], sec=sec)
        self.assertTrue(d.belgeler["B1"]["prog"])

    def test_esz_ag_yokken_belirsiz_numara_catali_K32(self):
        _, adaylar = kos([{"islem": "ag", "durum": "yok"}, K("B1", "K1", "2026-06-16"), K("B2", "K1", "2026-06-17"), {"islem": "esz_tumunu_gonder"}])
        durum = sorted((no(a, "B1"), no(a, "B2")) for a in adaylar)
        self.assertEqual(durum, [("", ""), ("TEA2026000000001", "")])
        self.assertTrue(all(not a.belgeler["B1"]["edm"] for a in adaylar))

    def test_esz_tek_tur_gibi_K19(self):
        a, _ = kos([K("B1", "K1", "2026-06-15"), K("B2", "K2", "2026-06-16"), {"islem": "esz_tumunu_gonder"}])
        b, _ = kos([K("B1", "K1", "2026-06-15"), K("B2", "K2", "2026-06-16"), T])
        self.assertEqual(M.goruntu(a), M.goruntu(b))


class Kagit(unittest.TestCase):
    def test_kagit_seri_ve_tarih_sirasi_K6(self):
        d, _ = kos([{"islem": "kagit_kaydet", "belge": "B1", "cari": "K1", "tarih": "2026-06-16"},
                    {"islem": "kagit_kaydet", "belge": "B2", "cari": "K2", "tarih": "2026-06-17"},
                    {"islem": "kagit_kaydet", "belge": "B3", "cari": "K1", "tarih": "2026-06-15"}, T])
        self.assertEqual((no(d, "B1"), no(d, "B2")), ("FIS2026000000001", "FIS2026000000002"))
        self.assertFalse(d.belgeler["B3"]["var"])
        self.assertFalse(d.belgeler["B1"]["edm"] or d.belgeler["B2"]["edm"])


def KG(ad, tarih, cari="K1"):
    return {"islem": "kagit_kaydet", "belge": ad, "cari": cari, "tarih": tarih}


def BELIRSIZ(ad="B1"):
    """İlk kaydet adımında Sonucu Belirsiz (EDM'de var) dünyasını seçer; sonraki adımlarda ilk aday."""
    return lambda ad_, a: next((x for x in ad_ if x.belgeler.get(ad, {}).get("belirsiz") and x.belgeler[ad].get("edm")), ad_[0]) if a["islem"] == "kaydet" else ad_[0]


class KagitNumara(unittest.TestCase):
    """/3: K38 verilmiş kâğıt numarası bir daha verilmez ([KULLANICI] 22.10 + E6), K39 Silinenler, K40 Kâğıt Makbuz / Müşteri Fişi."""

    def test_birakilan_fatura_fis_alir_tek_dunya_K40(self):
        d, adaylar = kos([K("B1", "K1", "2026-06-17"), {"islem": "listeden_sil", "belge": "B1"}])
        self.assertEqual((len(adaylar), d.yanit, no(d, "B1"), d.belgeler["B1"]["silindi"]), (1, "2xx", "FIS2026000000001", True))

    def test_birakilan_makbuz_smm_alir_sonra_gonderilmez_K40(self):
        d, adaylar = kos([S("B1", "K1", "2026-06-17"), {"islem": "listeden_sil", "belge": "B1"}])
        self.assertEqual((len(adaylar), no(d, "B1")), (1, "SMM2026000000001"))
        d, adaylar = kos([S("B1", "K1", "2026-06-17"), {"islem": "listeden_sil", "belge": "B1"}, {"islem": "kart_gonder", "belge": "B1"}, T])
        self.assertEqual((d.yanit, no(d, "B1"), d.belgeler["B1"]["edm"], d.belgeler["B1"]["silindi"]), (None, "SMM2026000000001", False, True))
        d, _ = kos([S("B1", "K1", "2026-06-17"), {"islem": "listeden_sil", "belge": "B1"}, {"islem": "kart_gonder", "belge": "B1"}])
        self.assertEqual((d.yanit, d.belgeler["B1"]["edm"]), ("4xx", False))

    def test_gonderilen_musteri_fisinin_numarasi_emekli_K38(self):
        # tohum 2 × 120 adım 5–10: Müşteri Fişi FIS…1 (16.06) e-Arşiv olarak gönderildi → FIS…1 emekli; 15.06 kâğıt belge reddedilir, 16.06 FIS…2 alır.
        d, _ = kos([K("B1", "K1", "2026-06-16"), {"islem": "listeden_sil", "belge": "B1"}, {"islem": "kart_gonder", "belge": "B1"}, KG("B2", "2026-06-15")])
        self.assertEqual((no(d, "B1"), d.belgeler["B2"]["var"], d.yanit), ("TEA2026000000001", False, "4xx"))
        d, _ = kos([K("B1", "K1", "2026-06-16"), {"islem": "listeden_sil", "belge": "B1"}, {"islem": "kart_gonder", "belge": "B1"}, KG("B2", "2026-06-16"),
                    K("B3", "K1", "2026-06-17"), {"islem": "listeden_sil", "belge": "B3"}])
        self.assertEqual((no(d, "B2"), no(d, "B3")), ("FIS2026000000002", "FIS2026000000003"))

    def test_silinen_kagit_numarasi_serbest_kalmaz_K38_K39(self):
        d, _ = kos([KG("B1", "2026-06-15"), KG("B2", "2026-06-16"), {"islem": "sil", "belge": "B2"}, KG("B3", "2026-06-15")])
        self.assertEqual((d.belgeler["B2"]["cop"], d.belgeler["B3"]["var"], d.yanit), (True, False, "4xx"))
        d, _ = kos([KG("B1", "2026-06-15"), KG("B2", "2026-06-16"), {"islem": "sil", "belge": "B2"}, KG("B3", "2026-06-16")])
        self.assertEqual(no(d, "B3"), "FIS2026000000003")

    def test_numarasiz_silme_tabani_degistirmez_bekletmez_K39(self):
        d, _ = kos([K("B1", "K1", "2026-06-15"), {"islem": "sil", "belge": "B1"}, K("B2", "K1", "2026-06-17", "simdi")])
        self.assertEqual((d.belgeler["B1"]["cop"], no(d, "B1"), no(d, "B2")), (True, "", "TEA2026000000001"))
        self.assertFalse(d.bekleyen(d.belgeler["B1"]))

    def test_gonderilmis_ve_belirsiz_silinmez_K39_K42(self):
        d, adaylar = kos([K("B1", "K1", "2026-06-17", "simdi"), {"islem": "sil", "belge": "B1"}])
        self.assertEqual((len(adaylar), d.yanit, d.belgeler["B1"].get("cop", False)), (1, "4xx", False))
        d, adaylar = kos([{"islem": "ariza", "tur": "kopma_sonra"}, K("B1", "K1", "2026-06-17", "simdi"), {"islem": "sil", "belge": "B1"}], sec=BELIRSIZ())
        self.assertEqual((d.yanit, d.belgeler["B1"].get("cop", False)), ("4xx", False))

    def test_geri_yukle_kendi_numarasiyla_K39(self):
        _, adaylar = kos([KG("B1", "2026-06-15"), {"islem": "sil", "belge": "B1"}, {"islem": "geri_yukle", "belge": "B1"}])
        self.assertTrue(adaylar)
        for a in adaylar:
            self.assertEqual((a.yanit, no(a, "B1"), a.belgeler["B1"]["cop"]), ("2xx", "FIS2026000000001", False))

    def test_silinenlerdeki_belge_gonderilmez_K39(self):
        d, _ = kos([K("B1", "K1", "2026-06-17"), {"islem": "sil", "belge": "B1"}, T, {"islem": "kart_gonder", "belge": "B1"}])
        self.assertEqual((d.yanit, d.belgeler["B1"]["edm"], no(d, "B1")), ("4xx", False, ""))


class YerelIptalK41(unittest.TestCase):
    """/3: K41 Yalnız Programda İptal yalnız sonucu belirsiz gönderimde ([KULLANICI] E7; K35 çatalı karara bağlandı)."""

    def test_gonderilmis_belgede_red_belge_degismez_K41(self):
        for kur in (K, S):
            d, adaylar = kos([kur("B1", "K1", "2026-06-17", "simdi"), G(2), {"islem": "iptal", "belge": "B1", "yerel": True}])
            self.assertEqual((len(adaylar), d.yanit, d.belgeler["B1"]["iptal"], d.belgeler["B1"]["edm_iptal"]), (1, "4xx", False, False), kur.__name__)

    def test_gonderilmemis_bekleyen_birakilmis_kagit_red_K41(self):
        for adimlar in ([K("B1", "K1", "2026-06-17")], [K("B1", "K1", "2026-06-17"), {"islem": "listeden_sil", "belge": "B1"}], [KG("B1", "2026-06-17")],
                        [K("B1", "K2", "2026-06-17", "simdi")]):
            d, adaylar = kos(adimlar + [{"islem": "iptal", "belge": "B1", "yerel": True}])
            self.assertEqual((len(adaylar), d.yanit, d.belgeler["B1"]["iptal"]), (1, "4xx", False), str(adimlar))

    def test_belirsizde_8_gun_icinde_yalniz_programda_iptal_K41(self):
        for kur in (K, S):
            d, adaylar = kos([{"islem": "ariza", "tur": "kopma_sonra"}, kur("B1", "K1", "2026-06-17", "simdi"), G(3), {"islem": "iptal", "belge": "B1", "yerel": True}],
                             sec=BELIRSIZ())
            self.assertEqual((len(adaylar), d.yanit, d.belgeler["B1"]["iptal"], d.belgeler["B1"]["edm_iptal"]), (1, "2xx", True, False), kur.__name__)


class BelirsizK42(unittest.TestCase):
    """/3: K42 Sonucu Belirsiz belgede Sil, Düzenle, İptal Et (olağan) ve Listeden Sil 409 ([KULLANICI] E1)."""

    def test_belirsizde_islemler_red_K42(self):
        for islem in ({"islem": "iptal", "belge": "B1"}, {"islem": "listeden_sil", "belge": "B1"}, {"islem": "duzenle_tarih", "belge": "B1", "tarih": "2026-06-16"},
                      {"islem": "sil", "belge": "B1"}):
            d, adaylar = kos([{"islem": "ariza", "tur": "kopma_sonra"}, K("B1", "K1", "2026-06-17", "simdi"), islem], sec=BELIRSIZ())
            self.assertEqual((len(adaylar), d.yanit, d.belgeler["B1"]["iptal"], d.belgeler["B1"]["silindi"], d.belgeler["B1"]["tarih"]),
                             (1, "4xx", False, False, "2026-06-17"), islem["islem"])

    def test_belirsiz_yeniden_gonder_ikinci_kez_kabul_yok_K42_K11(self):
        d, _ = kos([{"islem": "ariza", "tur": "kopma_sonra"}, K("B1", "K1", "2026-06-17", "simdi"), {"islem": "kart_gonder", "belge": "B1"}], sec=BELIRSIZ())
        self.assertEqual((no(d, "B1"), d.belgeler["B1"]["prog"]), ("TEA2026000000001", True))


class Ozellik(unittest.TestCase):
    """Üretecin rastgele senaryolarında modelin ilk dünyası kendi değişmezlerini korur (öz tutarlılık)."""

    def test_rastgele_senaryolarda_degismezler(self):
        import uretici
        for tohum in range(1, 16):
            s = uretici.uret(tohum, 150)
            m = M.Model(s)
            for a in s["adimlar"]:
                once = {k: dict(v) for k, v in m.dunyalar[0].belgeler.items()}
                m.adim(a)
                d = m.sec()
                seriler = {}
                for b in d.belgeler.values():
                    if b.get("var") is not True:
                        continue
                    ob = once.get(b["ad"], {})
                    if ob.get("var") is True and ob.get("numara") and ob["numara"] != b["numara"] and not ob["numara"].startswith("FIS"):
                        self.fail(f"t{tohum} adım {a['no']}: {b['ad']} numarası değişti")
                    if b["edm"] and not ob.get("edm") and ob.get("var") is True:
                        if ob.get("iptal"):
                            self.fail(f"t{tohum} adım {a['no']}: iptal belge gitti")
                        if ob.get("silindi") and a["islem"] in ("tumunu_gonder", "esz_tumunu_gonder"):
                            self.fail(f"t{tohum} adım {a['no']}: silinmiş belge turda gitti")
                        if d.engel(b):
                            self.fail(f"t{tohum} adım {a['no']}: engelli belge gitti ({d.engel(b)})")
                    if b["numara"]:
                        p = M.coz_numara(b["numara"])
                        self.assertEqual(str(p[1]), b["tarih"][:4])
                        seriler.setdefault(p[:2], []).append((p[2], b["tarih"]))
                for no_, t in d.emekli.items():  # K38: emekli kâğıt numarası da seridedir (boşluk değil)
                    p = M.coz_numara(no_)
                    seriler.setdefault(p[:2], []).append((p[2], t))
                for k, xs in seriler.items():
                    xs.sort()
                    self.assertEqual([x[0] for x in xs], list(range(1, len(xs) + 1)), f"t{tohum} adım {a['no']} {k} boşluk")
                    if k[0] != "FIS":
                        self.assertEqual([x[1] for x in xs], sorted(x[1] for x in xs), f"t{tohum} adım {a['no']} {k} tarih")


class DegismezDenetimi(unittest.TestCase):
    """fark.py değişmezleri yapay (bilerek bozuk) gözlemde ateşlenir — kâhinin ikinci yarısının dişi."""

    def setUp(self):
        import fark
        self.fark = fark
        self.dg = fark.Degismez()
        self.tur = dict(CARILER)

    def kayit(self, belgeler, kabul=(), cariler=None, yanit=None, ek=None, bugun="2026-06-17", iptal=(), iptal_servis=None, on_hesap=None):
        g = {}
        for ad, (numara, tarih, profil, estatus, durum) in belgeler.items():
            g[ad] = {"id": ad, "ettn": "u-" + ad, "numara": numara, "eStatus": estatus, "durum": durum, "tarih": tarih, "profil": profil,
                     "accountId": "a", "bekleyen": estatus == "waiting"}
        return {"gozlem": g, "edm": {"kabul": list(kabul), "iptal": list(iptal), "iptalServis": iptal_servis or ["efatura"] * len(iptal)},
                "cariler": cariler or {k: {"eInvoice": 0, "eAlias": ""} for k in CARILER}, "yanit": yanit, "ek": ek, "bugun": bugun, "onHesap": on_hesap}

    def kodlar(self, adim, kayit, denemeler=()):
        return {x["kod"] for x in self.dg.denetle(adim, kayit, list(denemeler), self.tur)}

    def test_emekli_numara_bosluk_degil_yeniden_verilirse_I26_I1(self):
        # /3 K38: FIS…1 görüldü, belge e-Belge olarak gitti (numara düştü), FIS…2 yeni belgede → I1 yok; FIS…1 başka belgede görünürse I26.
        self.kodlar({"no": 1, "islem": "listeden_sil"}, self.kayit({"B1": ("FIS2026000000001", "2026-06-16", "EARSIVFATURA", "withdrawn", "issued")}))
        self.kodlar({"no": 2, "islem": "kart_gonder"}, self.kayit({"B1": ("TEA2026000000001", "2026-06-16", "EARSIVFATURA", "sent", "issued")},
                                                                  kabul=[{"id": "TEA2026000000001", "uuid": "u-B1", "earchive": "true", "vkn": "10000000146", "alias": ""}]))
        k = self.kayit({"B1": ("TEA2026000000001", "2026-06-16", "EARSIVFATURA", "sent", "issued"), "B2": ("FIS2026000000002", "2026-06-17", "KAGIT", "none", "issued")})
        self.assertNotIn("I1", self.kodlar({"no": 3, "islem": "kagit_kaydet"}, k))
        k = self.kayit({"B1": ("TEA2026000000001", "2026-06-16", "EARSIVFATURA", "sent", "issued"), "B2": ("FIS2026000000002", "2026-06-17", "KAGIT", "none", "issued"),
                        "B3": ("FIS2026000000001", "2026-06-17", "KAGIT", "none", "issued")})
        self.assertIn("I26", self.kodlar({"no": 4, "islem": "kagit_kaydet"}, k))

    def test_emekli_numaranin_tarihi_sirada_I2(self):
        self.kodlar({"no": 1, "islem": "x"}, self.kayit({"B1": ("FIS2026000000001", "2026-06-16", "EARSIVFATURA", "withdrawn", "issued")}))
        k = self.kayit({"B1": ("TEA2026000000001", "2026-06-16", "EARSIVFATURA", "waiting", "issued"), "B2": ("FIS2026000000002", "2026-06-15", "KAGIT", "none", "issued")})
        self.assertIn("I2", self.kodlar({"no": 2, "islem": "kagit_kaydet"}, k))

    def test_belirsiz_ve_edmde_olan_yeniden_gonderilmez_I25(self):
        kab = [{"id": "TEA2026000000001", "uuid": "u-B1", "earchive": "true", "vkn": "10000000146", "alias": ""}]
        self.kodlar({"no": 1, "islem": "kaydet"}, self.kayit({"B1": ("TEA2026000000001", "2026-06-17", "EARSIVFATURA", "none", "issued")}, kabul=kab))
        k = self.kayit({"B1": ("TEA2026000000001", "2026-06-17", "EARSIVFATURA", "sent", "issued")})
        self.assertIn("I25", self.kodlar({"no": 2, "islem": "kart_gonder"}, k, [{"id": "TEA2026000000001", "uuid": "u-B1"}]))
        dg = self.fark.Degismez()
        dg.denetle({"no": 1, "islem": "kaydet"}, self.kayit({"B1": ("TEA2026000000001", "2026-06-17", "EARSIVFATURA", "none", "issued")}), [], self.tur)
        self.assertNotIn("I25", {x["kod"] for x in dg.denetle({"no": 2, "islem": "kart_gonder"}, k, [{"id": "TEA2026000000001", "uuid": "u-B1"}], self.tur)})

    def test_silinenlerdeki_belge_gonderilmez_I8(self):
        k = self.kayit({"B1": ("", "2026-06-17", "EARSIVFATURA", "waiting", "issued")})
        k["gozlem"]["B1"]["cop"] = True
        self.kodlar({"no": 1, "islem": "sil"}, k)
        k2 = self.kayit({"B1": ("TEA2026000000001", "2026-06-17", "EARSIVFATURA", "waiting", "issued")})
        self.assertIn("I8", self.kodlar({"no": 2, "islem": "kart_gonder"}, k2, [{"id": "TEA2026000000001", "uuid": "u-B1"}]))

    def test_temiz_gozlemde_ihlal_yok(self):
        k = self.kayit({"B1": ("TEA2026000000001", "2026-06-15", "EARSIVFATURA", "sent", "issued"),
                        "B2": ("TEA2026000000002", "2026-06-16", "EARSIVFATURA", "sent", "issued")},
                       kabul=[{"id": "TEA2026000000001", "uuid": "u-B1", "earchive": "true", "vkn": "10000000146", "alias": ""},
                              {"id": "TEA2026000000002", "uuid": "u-B2", "earchive": "true", "vkn": "10000000146", "alias": ""}])
        self.assertEqual(self.kodlar({"no": 1, "islem": "tumunu_gonder"}, k, [{"id": "TEA2026000000001", "uuid": "u-B1"}]), set())

    def test_bosluk_ve_tarih_sirasi_I1_I2(self):
        k = self.kayit({"B1": ("TEF2026000000001", "2026-06-16", "TEMELFATURA", "waiting", "issued"),
                        "B2": ("TEF2026000000003", "2026-06-15", "TEMELFATURA", "waiting", "issued")})
        self.assertTrue({"I1", "I2"} <= self.kodlar({"no": 1, "islem": "x"}, k))

    def test_cift_kabul_ve_mukellefe_eArsiv_I3_I7_I11(self):
        kab = {"id": "TEA2026000000001", "uuid": "u-B1", "earchive": "true", "vkn": "9876543217", "alias": ""}
        k = self.kayit({"B1": ("TEA2026000000001", "2026-06-16", "EARSIVFATURA", "sent", "issued")},
                       kabul=[kab, dict(kab, id="TEA2026000000002"), {"id": "TEF2026000000001", "uuid": "u-B9", "earchive": "", "vkn": "9876543217", "alias": ""}])
        self.assertTrue({"I3", "I7", "I11"} <= self.kodlar({"no": 1, "islem": "x"}, k))

    def test_numarasiz_ya_da_yanlis_seri_deneme_I6(self):
        k = self.kayit({"B1": ("", "2026-06-16", "EARSIVFATURA", "waiting", "issued")})
        self.assertIn("I6", self.kodlar({"no": 1, "islem": "x"}, k, [{"id": "", "uuid": "u-B1"}]))
        k = self.kayit({"B1": ("TEF2026000000001", "2026-06-16", "EARSIVFATURA", "waiting", "issued")})
        self.assertIn("I6", self.kodlar({"no": 2, "islem": "x"}, k, [{"id": "TEF2026000000001", "uuid": "u-B1"}]))

    def test_iptal_ve_silinen_gonderilmez_I8(self):
        self.kodlar({"no": 1, "islem": "x"}, self.kayit({"B1": ("", "2026-06-16", "EARSIVFATURA", "waiting", "cancelled"),
                                                        "B2": ("FIS2026000000001", "2026-06-16", "EARSIVFATURA", "withdrawn", "issued")}))
        k = self.kayit({"B1": ("", "2026-06-16", "EARSIVFATURA", "waiting", "cancelled"),
                        "B2": ("FIS2026000000001", "2026-06-16", "EARSIVFATURA", "withdrawn", "issued")})
        self.assertIn("I8", self.kodlar({"no": 2, "islem": "tumunu_gonder"}, k, [{"id": "TEA2026000000001", "uuid": "u-B1"}, {"id": "TEA2026000000002", "uuid": "u-B2"}]))

    def test_gonderilmis_degisir_numara_degisir_I4_I5_I9_I10(self):
        kab = [{"id": "TEA2026000000001", "uuid": "u-B1", "earchive": "true", "vkn": "10000000146", "alias": ""}]
        self.kodlar({"no": 1, "islem": "x"}, self.kayit({"B1": ("TEA2026000000001", "2026-06-16", "EARSIVFATURA", "sent", "issued")}, kabul=kab))
        k = self.kayit({"B1": ("TEA2026000000002", "2026-06-15", "EARSIVFATURA", "sent", "issued"),
                        "B2": ("TEA2026000000001", "2026-06-15", "EARSIVFATURA", "sent", "issued")})
        self.assertTrue({"I4", "I5", "I9", "I10"} <= self.kodlar({"no": 2, "islem": "x"}, k))

    def test_kisi_carisi_isaretlenmez_I14_ve_esz_hata_I15(self):
        car = {k: {"eInvoice": 0, "eAlias": ""} for k in CARILER}
        car["K1"] = {"eInvoice": 1, "eAlias": ""}
        kab = [{"id": "TEA2026000000001", "uuid": "u-B1", "earchive": "true", "vkn": "10000000146", "alias": ""}]
        k = self.kayit({"B1": ("TEA2026000000001", "2026-06-16", "EARSIVFATURA", "sent", "issued")}, kabul=kab, cariler=car,
                       ek={"sonuclar": [[{"ad": "B1", "ok": True, "numara": "TEA2026000000001"}], [{"ad": "B1", "ok": False, "numara": "", "kod": "x"}]]})
        self.assertTrue({"I14", "I15"} <= self.kodlar({"no": 1, "islem": "esz_tumunu_gonder"}, k))

    def test_tur_sonucu_kodsuz_I19(self):
        k = self.kayit({"B1": ("", "2026-06-16", "TEMELFATURA", "waiting", "issued")},
                       ek={"sonuclar": [{"ad": "B1", "ok": False, "numara": "", "kod": "", "ileti": ""}]})
        self.assertIn("I19", self.kodlar({"no": 1, "islem": "tumunu_gonder"}, k))
        k = self.kayit({"B1": ("", "2026-06-16", "TEMELFATURA", "waiting", "issued")},
                       ek={"sonuclar": [{"ad": "B1", "ok": False, "numara": "", "kod": "series-waiting", "ileti": "Daha eski belge bekliyor"}]})
        self.assertNotIn("I19", self.kodlar({"no": 2, "islem": "tumunu_gonder"}, k))

    def test_esz_belirsiz_hata_sayilmaz_I15(self):
        kab = [{"id": "TEA2026000000001", "uuid": "u-B1", "earchive": "true", "vkn": "10000000146", "alias": ""}]
        k = self.kayit({"B1": ("TEA2026000000001", "2026-06-16", "EARSIVFATURA", "sent", "issued")}, kabul=kab,
                       ek={"sonuclar": [[{"ad": "B1", "ok": True, "numara": "TEA2026000000001"}], [{"ad": "B1", "ok": False, "numara": "", "kod": "integrator-uncertain", "ileti": "belirsiz"}]]})
        self.assertNotIn("I15", self.kodlar({"no": 1, "islem": "esz_tumunu_gonder"}, k))

    def test_esz_enjekte_arizali_belge_I15_disi(self):
        kab = [{"id": "TEA2026000000001", "uuid": "u-B1", "earchive": "true", "vkn": "10000000146", "alias": ""}]
        k = self.kayit({"B1": ("TEA2026000000001", "2026-06-16", "EARSIVFATURA", "sent", "issued")}, kabul=kab,
                       ek={"sonuclar": [[{"ad": "B1", "ok": True, "numara": "TEA2026000000001"}], [{"ad": "B1", "ok": False, "numara": "", "kod": "integrator-rejected", "ileti": "x"}]]})
        self.assertNotIn("I15", self.kodlar({"no": 1, "islem": "esz_tumunu_gonder"}, k, [{"id": "TEA2026000000001", "uuid": "u-B1", "ariza": "gecici_hata"}]))
        self.assertIn("I15", self.kodlar({"no": 2, "islem": "esz_tumunu_gonder"}, k, [{"id": "TEA2026000000001", "uuid": "u-B1", "ariza": ""}]))

    def test_sonda_tutarsizlik_I18(self):
        k = self.kayit({"B1": ("TEA2026000000001", "2026-06-16", "EARSIVFATURA", "waiting", "issued")},
                       kabul=[{"id": "TEA2026000000001", "uuid": "u-B1", "earchive": "true", "vkn": "10000000146", "alias": ""}])
        self.dg.denetle({"no": 1, "islem": "x"}, k, [], self.tur)
        self.assertEqual({x["kod"] for x in self.dg.son(k)}, {"I18"})


class DegismezDenetimi2(unittest.TestCase):
    """/2 değişmezleri I20–I24 yapay (bilerek bozuk) gözlemde ateşlenir."""
    setUp = DegismezDenetimi.setUp
    kayit = DegismezDenetimi.kayit
    kodlar = DegismezDenetimi.kodlar

    def test_servis_I20(self):
        k = self.kayit({"B1": ("TES2026000000001", "2026-06-16", "ESMM", "sent", "issued")},
                       kabul=[{"id": "TES2026000000001", "uuid": "u-B1", "earchive": "", "vkn": "", "alias": "x", "servis": "efatura", "alici": None}])
        self.assertIn("I20", self.kodlar({"no": 1, "islem": "x"}, k, [{"id": "TES2026000000001", "uuid": "u-B1", "servis": "efatura"}]))
        k = self.kayit({"B2": ("TEA2026000000001", "2026-06-16", "EARSIVFATURA", "sent", "issued")},
                       kabul=[{"id": "TEA2026000000001", "uuid": "u-B2", "earchive": "smm", "vkn": "", "alias": "", "servis": "smm", "alici": None}])
        self.assertIn("I20", self.kodlar({"no": 2, "islem": "x"}, k))

    def test_alici_alanlari_I21(self):
        al = {"il": "", "vd": "", "kimlikTur": "VKN", "kimlik": "9876543217", "odenecek": 600}
        k = self.kayit({"B1": ("TEF2026000000001", "2026-06-16", "TEMELFATURA", "sent", "issued")},
                       kabul=[{"id": "TEF2026000000001", "uuid": "u-B1", "earchive": "", "vkn": "9876543217", "alias": "pk", "servis": "efatura", "alici": al}])
        kod = [x for x in self.dg.denetle({"no": 1, "islem": "x"}, k, [], self.tur) if x["kod"] == "I21"]
        self.assertEqual(len(kod), 2)  # il boş + vergi dairesi boş
        k = self.kayit({"B2": ("TEA2026000000001", "2026-06-16", "EARSIVFATURA", "sent", "issued")},
                       kabul=[{"id": "TEA2026000000001", "uuid": "u-B2", "earchive": "true", "vkn": "", "alias": "", "servis": "efatura",
                               "alici": {"il": "Ankara", "vd": "", "kimlikTur": "TCKN", "kimlik": "11111111111", "odenecek": 48000}}])
        self.assertIn("I21", self.kodlar({"no": 2, "islem": "x"}, k))
        k = self.kayit({"B3": ("TEA2026000000002", "2026-06-16", "EARSIVFATURA", "sent", "issued")},
                       kabul=[{"id": "TEA2026000000002", "uuid": "u-B3", "earchive": "true", "vkn": "", "alias": "", "servis": "efatura",
                               "alici": {"il": "Ankara", "vd": "", "kimlikTur": "TCKN", "kimlik": "11111111111", "odenecek": 600}}])
        self.assertNotIn("I21", self.kodlar({"no": 3, "islem": "x"}, k))

    def test_iptal_suresi_ve_efatura_iptali_I22(self):
        kab = [{"id": "TEA2026000000001", "uuid": "u-B1", "earchive": "true", "vkn": "", "alias": "", "servis": "efatura", "alici": None}]
        self.kodlar({"no": 1, "islem": "x"}, self.kayit({"B1": ("TEA2026000000001", "2026-06-10", "EARSIVFATURA", "sent", "issued")}, kabul=kab, bugun="2026-06-17"))
        k = self.kayit({"B1": ("TEA2026000000001", "2026-06-10", "EARSIVFATURA", "cancelled", "cancelled")}, bugun="2026-06-25", iptal=["u-B1"])
        self.assertNotIn("I22", self.kodlar({"no": 2, "islem": "iptal"}, k))  # iletimden 8. gün (kesimden 15.)
        k = self.kayit({"B1": ("TEA2026000000001", "2026-06-10", "EARSIVFATURA", "cancelled", "cancelled")}, bugun="2026-06-26", iptal=["u-B1"])
        self.assertIn("I22", self.kodlar({"no": 3, "islem": "iptal"}, k))
        k = self.kayit({"B2": ("TEF2026000000001", "2026-06-17", "TEMELFATURA", "cancelled", "cancelled")}, iptal=["u-B2"])
        self.assertIn("I22", self.kodlar({"no": 4, "islem": "iptal"}, k))

    def test_soru_gonderimden_once_I24(self):
        k = self.kayit({}, ek={"soru": {"eskiler": ["B1"], "ilkIstekDeneme": 1, "ilkIstekNumaraDegisen": []}})
        self.assertIn("I24", self.kodlar({"no": 1, "islem": "tumunu_gonder", "eski": "vazgec"}, k))
        k = self.kayit({}, ek={"soru": {"eskiler": ["B1"], "ilkIstekDeneme": 0, "ilkIstekNumaraDegisen": []}})
        self.assertNotIn("I24", self.kodlar({"no": 2, "islem": "tumunu_gonder", "eski": "vazgec"}, k))

    def test_on_hesap_kayit_I23(self):
        oh = {"status": 200, "blockers": [], "partyProblems": ["Cari (alıcı): il zorunludur (adres)."]}
        k = self.kayit({}, yanit={"status": 200, "kod": "", "veri": "{}"}, on_hesap=oh)
        self.assertIn("I23", self.kodlar({"no": 1, "islem": "kaydet", "belge": "B1"}, k))
        k = self.kayit({}, yanit={"status": 400, "kod": "einvoice-party", "veri": '{"error":"Cari (alıcı): il zorunludur (adres)."}'}, on_hesap=oh)
        self.assertNotIn("I23", self.kodlar({"no": 2, "islem": "kaydet", "belge": "B2"}, k))
        k = self.kayit({}, yanit={"status": 409, "kod": "chronology", "veri": "{}"}, on_hesap={"status": 200, "blockers": [], "partyProblems": []})
        self.assertIn("I23", self.kodlar({"no": 3, "islem": "kaydet", "belge": "B3"}, k))
        dg = self.fark.Degismez(ux15=False)
        self.assertNotIn("I23", {x["kod"] for x in dg.denetle({"no": 3, "islem": "kaydet", "belge": "B3"}, k, [], self.tur)})


if __name__ == "__main__":
    sonuc = unittest.main(verbosity=1, exit=False).result
    # kanıt aracı (tools/kanit.mjs) node:test biçimini okur
    kirmizi = len(sonuc.failures) + len(sonuc.errors)
    print(f"# tests {sonuc.testsRun}")
    print(f"# pass {sonuc.testsRun - kirmizi}")
    print(f"# fail {kirmizi}")
    sys.exit(1 if kirmizi else 0)
