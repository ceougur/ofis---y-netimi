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

CARILER = {"K1": "kisi", "K2": "mukellef", "K3": "mukellef_pksiz", "K4": "gizli_mukellef", "K5": "kisi"}


def senaryo(adimlar, bugun="2026-06-17"):
    return {"dil": M.DIL, "ad": "birim", "bugun": bugun, "cariler": dict(CARILER),
            "adimlar": [dict(a, no=i + 1) for i, a in enumerate(adimlar)]}


def kos(adimlar, bugun="2026-06-17", sec=None):
    """Modeli koşar; her adımda ilk aday (ya da sec(adaylar) ile seçilen) alınır. Son dünya ve son adım adayları döner."""
    m = M.Model(senaryo(adimlar, bugun))
    for a in m.senaryo["adimlar"]:
        m.adim(a)
        if sec:
            m.dunyalar = [sec(m.adaylar, a)]
        else:
            m.sec()
    return m.dunyalar[0], m.adaylar


def K(ad, cari, tarih, gonder="sonra"):
    return {"islem": "kaydet", "belge": ad, "cari": cari, "tarih": tarih, "gonder": gonder}


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
        d, _ = kos([K("B1", "K1", "2026-06-17", "simdi"), K("B2", "K1", "2026-06-10"), T, K("B3", "K5", "2026-06-17"), T])
        self.assertEqual(no(d, "B2"), "")
        self.assertFalse(d.belgeler["B2"]["edm"])
        self.assertTrue(d.bekleyen(d.belgeler["B2"]))
        self.assertEqual(no(d, "B3"), "TEA2026000000002")

    def test_sonra_kaydi_tarih_sirasina_uymazsa_catal_K29(self):
        _, adaylar = kos([K("B1", "K1", "2026-06-17", "simdi"), K("B2", "K1", "2026-06-10")])
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

    def test_pk_yok_engelli_bekletmez_K2_K9(self):
        d, _ = kos([K("B1", "K3", "2026-06-15"), K("B2", "K2", "2026-06-17", "simdi")])
        self.assertEqual(no(d, "B2"), "TEF2026000000001")
        d, _ = kos([K("B1", "K3", "2026-06-15"), K("B2", "K2", "2026-06-17"), T])
        self.assertEqual((no(d, "B1"), no(d, "B2")), ("", "TEF2026000000001"))
        self.assertFalse(d.belgeler["B1"]["edm"])

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

    def test_gonderilmis_listeden_silinmez_K20(self):
        d, _ = kos([K("B1", "K1", "2026-06-17", "simdi"), {"islem": "listeden_sil", "belge": "B1"}])
        self.assertEqual(d.yanit, "4xx")
        self.assertFalse(d.belgeler["B1"]["silindi"])

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

    def kayit(self, belgeler, kabul=(), cariler=None, yanit=None, ek=None):
        g = {}
        for ad, (numara, tarih, profil, estatus, durum) in belgeler.items():
            g[ad] = {"id": ad, "ettn": "u-" + ad, "numara": numara, "eStatus": estatus, "durum": durum, "tarih": tarih, "profil": profil,
                     "accountId": "a", "bekleyen": estatus == "waiting"}
        return {"gozlem": g, "edm": {"kabul": list(kabul), "iptal": []}, "cariler": cariler or {k: {"eInvoice": 0, "eAlias": ""} for k in CARILER},
                "yanit": yanit, "ek": ek}

    def kodlar(self, adim, kayit, denemeler=()):
        return {x["kod"] for x in self.dg.denetle(adim, kayit, list(denemeler), self.tur)}

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

    def test_sonda_tutarsizlik_I18(self):
        k = self.kayit({"B1": ("TEA2026000000001", "2026-06-16", "EARSIVFATURA", "waiting", "issued")},
                       kabul=[{"id": "TEA2026000000001", "uuid": "u-B1", "earchive": "true", "vkn": "10000000146", "alias": ""}])
        self.dg.denetle({"no": 1, "islem": "x"}, k, [], self.tur)
        self.assertEqual({x["kod"] for x in self.dg.son(k)}, {"I18"})


if __name__ == "__main__":
    sonuc = unittest.main(verbosity=1, exit=False).result
    # kanıt aracı (tools/kanit.mjs) node:test biçimini okur
    kirmizi = len(sonuc.failures) + len(sonuc.errors)
    print(f"# tests {sonuc.testsRun}")
    print(f"# pass {sonuc.testsRun - kirmizi}")
    print(f"# fail {kirmizi}")
    sys.exit(1 if kirmizi else 0)
