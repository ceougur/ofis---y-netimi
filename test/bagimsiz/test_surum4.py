#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""SENARYO-DILI sürüm 4 (Şüpheli Ticari Alacaklar — plan §3.11b, KABUL K1–K12; K8 taksit — plan §3.10/3) iki kâhinde ortak testi.

Koşu:  python3 -I test/bagimsiz/test_surum4.py -v

Her test aynı senaryoyu model_a ve model_b'ye komut satırından verir ve sonucu elle hesaplanmış beklenenle karşılaştırır.
Beklenen sayılar SENARYO-DILI.md §4.17, §4.39–4.42a ve docs/2.3.0-SUPHELI-KABUL.md §2 (kabul tablosu ve yan senaryolar B–W)
kurallarından elle hesaplandı (hesap her testin yorumunda); kâhinlerin ya da programın çıktısından kopyalanmadı. Temiz oda: bu dosya
programın kodunu okumaz. Sonda "N geçti, M kaldı" özeti yazılır (tools/kanit.mjs biçimi).
"""

import json
import os
import subprocess
import sys
import tempfile
import unittest

BURASI = os.path.dirname(os.path.abspath(__file__))
MODELLER = {"a": os.path.join(BURASI, "model_a", "model.py"), "b": os.path.join(BURASI, "model_b", "model.py")}
DIL = "destekofis-senaryo/4"


def sen(ad, adimlar, bugun="12.10.2026", ayarlar=None, dil=DIL, kullanicilar=None):
    b = {"bugun": bugun, "sirket": "bos", "ayarlar": ayarlar or {"kasaEksiBakiye": "uyar"}}
    if kullanicilar:
        b["kullanicilar"] = kullanicilar
    return {"dil": dil, "ad": ad, "baslangic": b, "adimlar": adimlar}


def kos(model, s):
    with tempfile.TemporaryDirectory() as d:
        yol = os.path.join(d, s["ad"] + ".json")
        with open(yol, "w", encoding="utf-8") as fh:
            json.dump(s, fh, ensure_ascii=False)
        p = subprocess.run([sys.executable, "-I", MODELLER[model], yol], capture_output=True, text=True)
        return p.returncode, (json.loads(p.stdout) if p.returncode == 0 else None), p.stderr


def cari(aid, ad, tur="musteri"):
    return {"id": aid, "islem": "cari_ac", "ad": ad, "unvan": ad + " Ltd.", "tur": tur}


def borc(aid, ad, c, tutar, tarih="01.10.2026", dahil=True, **kw):
    """Carinin 120 borcu: hizmet satış faturası (KDV %20; dahil → 120 = tutar)."""
    a = {"id": aid, "islem": "fatura", "ad": ad, "tur": "satis", "cari": c, "tarih": tarih,
         "kalemler": [{"hizmet": "Danışmanlık", "miktar": 1, "birimFiyat": tutar, "kdvOrani": 20, "kdvDahil": dahil}]}
    a.update(kw)
    return a


def al(aid, ad, c, tutar, tarih, neden="dava", **kw):
    a = {"id": aid, "islem": "supheli_al", "ad": ad, "cari": c, "tarih": tarih}
    if tutar is not None:
        a["tutar"] = tutar
        a["neden"] = neden
    a.update(kw)
    return a


def karsilik(aid, kayit, tutar, tarih, **kw):
    a = {"id": aid, "islem": "karsilik_ayir", "kayit": kayit, "tutar": tutar, "tarih": tarih}
    a.update(kw)
    return a


def cikar(aid, kayit, tarih, **kw):
    a = {"id": aid, "islem": "supheli_cikar", "kayit": kayit, "tarih": tarih}
    a.update(kw)
    return a


def degersiz(aid, kayit, tutar, tarih, **kw):
    a = {"id": aid, "islem": "degersiz_yaz", "kayit": kayit, "tutar": tutar, "tarih": tarih}
    a.update(kw)
    return a


def tahsilat(aid, c, tutar, tarih, **kw):
    a = {"id": aid, "islem": "cari_tahsilat", "cari": c, "tutar": tutar, "yol": "nakit", "tarih": tarih}
    a.update(kw)
    return a


def m(o, kod):
    x = o["mizan"].get(kod, {"borc": 0, "alacak": 0})
    return x["borc"] - x["alacak"]


def sup(tutar, karsilik_=0, tahsil=0, degersiz_=0, cikarilan=0, durum="acik"):
    return {"tutar": tutar, "karsilik": karsilik_, "tahsilEdilen": tahsil, "degersiz": degersiz_, "cikarilan": cikarilan,
            "kalan": tutar - tahsil - degersiz_ - cikarilan, "durum": durum}


class IkiModel(unittest.TestCase):
    def ikisi(self, s):
        out = {}
        for k in ("a", "b"):
            rc, o, err = kos(k, s)
            self.assertEqual(rc, 0, "model_%s çıkış %s: %s" % (k, rc, err))
            out[k] = o
        a, b = out["a"], out["b"]
        alanlar = [x for x in a if x not in ("kaynak",)]
        self.assertEqual({x: a[x] for x in alanlar}, {x: b[x] for x in alanlar}, "iki kâhin ayrışıyor")
        return a

    def ikisi_gecersiz(self, s, ipucu):
        for k in ("a", "b"):
            rc, _o, err = kos(k, s)
            self.assertEqual(rc, 2, "model_%s %s beklenirken çıkış %s (%s)" % (k, ipucu, rc, err))
            self.assertIn(ipucu, err, "model_%s: %s" % (k, err))

    def retler(self, o):
        return [(r["adim"], r["durum"], r["kod"]) for r in o["retler"]]


class KabulSupheli(IkiModel):
    def test_kabul_supheli_plan_sayilari(self):
        """senaryolar/kabul-supheli.json: KABUL §2 adım 0–4 (83 yaprak, plandan elle); ret yok; BELİRSİZ-36 yalnız değersizden sonra."""
        with open(os.path.join(BURASI, "senaryolar", "kabul-supheli.json"), encoding="utf-8") as fh:
            s = json.load(fh)
        o = self.ikisi(s)

        def yapraklar(x, yol=()):
            if isinstance(x, dict):
                for k, v in x.items():
                    yield from yapraklar(v, yol + (k,))
            else:
                yield yol, x
        n = 0
        for adim in s["adimlar"]:
            if adim["islem"] != "kontrol":
                continue
            for yol, beklenen in yapraklar(adim["planBeklenen"]):
                g = o["araDurumlar"][adim["id"]]
                for i, p in enumerate(yol):
                    g = g.get(p, {"borc": 0, "alacak": 0}) if yol[0] == "mizan" and i == 1 else g[p]
                self.assertEqual(g, beklenen, "%s %s" % (adim["id"], "/".join(yol)))
                n += 1
        self.assertEqual(n, 83)
        self.assertEqual(o["retler"], [])
        yollar = {x["alan"]: x["neden"] for x in o["belirsizler"]}
        self.assertEqual(yollar, {"faturalar.F1.acik": "BELİRSİZ-36", "araDurumlar.k4.faturalar.F1.acik": "BELİRSİZ-36"})
        # mizan dengesi (adım 4): 100 3.000 + 120 6.000 + 644 −1.500 + 654 2.500 + 600 −8.333,33 + 391 −1.666,67 = 0
        k4 = o["araDurumlar"]["k4"]
        self.assertEqual(sum(v["borc"] for v in k4["mizan"].values()), sum(v["alacak"] for v in k4["mizan"].values()))


class YanSenaryolar(IkiModel):
    def test_b_karsiliksiz_degersiz_659(self):
        """KABUL B: borç 5.000 → al 5.000 → tahsilat 2.000 → değersiz 3.000: 128 5.000 → 3.000 → 0; 659 = 3.000; 129 = 0; 120 = 0; cari 0."""
        o = self.ikisi(sen("s4-b", [
            cari("1", "XYZ"), borc("2", "F", "XYZ", "5000"),
            al("3", "S", "XYZ", "5000", "02.10.2026", neden="diger"), {"id": "k1", "islem": "kontrol"},
            tahsilat("4", "XYZ", "2000", "03.10.2026"), {"id": "k2", "islem": "kontrol"},
            degersiz("5", "S", "3000", "04.10.2026"),
        ]))
        self.assertEqual(m(o["araDurumlar"]["k1"], "128"), 500000)
        self.assertEqual(m(o["araDurumlar"]["k2"], "128"), 300000)
        self.assertEqual((m(o, "128"), m(o, "129"), m(o, "659"), m(o, "120"), m(o, "644")), (0, 0, 300000, 0, 0))
        self.assertEqual(o["cariler"]["XYZ"], 0)
        self.assertEqual(o["kasa"], 200000)
        self.assertEqual(o["supheliAlacaklar"]["S"], sup(500000, tahsil=200000, degersiz_=300000))
        self.assertEqual(o["retler"], [])

    def test_c_supheliden_cikar_ve_sonrasi(self):
        """KABUL C: borç 8.000 → al 3.000 (06.10) → karşılık 1.000 (07.10) → tahsilat 500 (08.10): 128 2.500, 129 −1.000 (644 yok) →
        çıkar (09.10): B 120 / A 128 2.500 + B 129 / A 644 1.000 → 128 0, 129 0, 644 −1.000, 120 7.500, cari 7.500. Çıkarılmışa karşılık /
        değersiz / ikinci çıkarma 409 doubtful-closed; sonraki tahsilat 1.000 → A 120 (128 0), cari 6.500 [KABUL §3/18]."""
        o = self.ikisi(sen("s4-c", [
            cari("1", "ABC"), borc("2", "F", "ABC", "8000"),
            al("3", "S", "ABC", "3000", "06.10.2026"), karsilik("4", "S", "1000", "07.10.2026"),
            tahsilat("5", "ABC", "500", "08.10.2026"), {"id": "k1", "islem": "kontrol"},
            cikar("6", "S", "09.10.2026"), {"id": "k2", "islem": "kontrol"},
            karsilik("7", "S", "100", "09.10.2026"), degersiz("8", "S", "100", "09.10.2026"), cikar("9", "S", "09.10.2026"),
            tahsilat("10", "ABC", "1000", "10.10.2026"),
        ]))
        k1, k2 = o["araDurumlar"]["k1"], o["araDurumlar"]["k2"]
        self.assertEqual((m(k1, "128"), m(k1, "129"), m(k1, "644"), m(k1, "120")), (250000, -100000, 0, 500000))
        self.assertEqual(k1["supheliAlacaklar"]["S"], sup(300000, karsilik_=100000, tahsil=50000))
        self.assertEqual((m(k2, "128"), m(k2, "129"), m(k2, "644"), m(k2, "120"), k2["cariler"]["ABC"]), (0, 0, -100000, 750000, 750000))
        self.assertEqual(k2["supheliAlacaklar"]["S"], sup(300000, tahsil=50000, cikarilan=250000, durum="cikarildi"))
        self.assertEqual(self.retler(o), [("7", 409, "doubtful-closed"), ("8", 409, "doubtful-closed"), ("9", 409, "doubtful-closed")])
        self.assertEqual((m(o, "128"), m(o, "120"), o["cariler"]["ABC"], o["kasa"]), (0, 650000, 650000, 150000))

    def test_d_tahsilat_supheliyi_asinca(self):
        """KABUL D: borç 10.000 → al 4.000 → tahsilat 5.000: A 128 4.000 + A 120 1.000 → 128 0, 120 5.000, cari 5.000."""
        o = self.ikisi(sen("s4-d", [
            cari("1", "ABC"), borc("2", "F", "ABC", "10000"), al("3", "S", "ABC", "4000", "02.10.2026"),
            tahsilat("4", "ABC", "5000", "03.10.2026"),
        ]))
        self.assertEqual((m(o, "128"), m(o, "120"), o["cariler"]["ABC"], o["kasa"]), (0, 500000, 500000, 500000))
        self.assertEqual(o["supheliAlacaklar"]["S"], sup(400000, tahsil=400000))

    def test_e_iki_kayit_en_eski_once(self):
        """KABUL E: al 2.000 (03.10), al 3.000 (04.10) → tahsilat 2.500 (05.10): kayıt 1 kalan 0 (tahsil 2.000), kayıt 2 kalan 2.500
        (tahsil 500); 128 = 2.500. Giriş sırası ters olsa da (önce 04.10'luk) sonuç aynı (tarih sırası, KABUL §3/1)."""
        for ad, sira in (("s4-e1", ["S1", "S2"]), ("s4-e2", ["S2", "S1"])):
            adimlar = [cari("1", "ABC"), borc("2", "F", "ABC", "10000")]
            kayitlar = {"S1": al("3", "S1", "ABC", "2000", "03.10.2026"), "S2": al("4", "S2", "ABC", "3000", "04.10.2026")}
            for i, k in enumerate(sira):
                x = dict(kayitlar[k])
                x["id"] = str(3 + i)
                adimlar.append(x)
            adimlar.append(tahsilat("5", "ABC", "2500", "05.10.2026"))
            o = self.ikisi(sen(ad, adimlar))
            self.assertEqual(o["supheliAlacaklar"]["S1"], sup(200000, tahsil=200000), ad)
            self.assertEqual(o["supheliAlacaklar"]["S2"], sup(300000, tahsil=50000), ad)
            self.assertEqual((m(o, "128"), m(o, "120"), o["cariler"]["ABC"]), (250000, 500000, 750000), ad)

    def test_f_tutar_borc_bakiyesini_asar(self):
        """KABUL F: borç 1.000 → al 1.500 → 400 doubtful-exceeds-balance; al 600 ✓; al 500 → 400 (600 + 500 > 1.000); al 400 ✓;
        al 1 → 400 (120 bakiyesi 0). 128 = 1.000, 120 = 0; reddedilen kayıtların adı çıktıda yok."""
        o = self.ikisi(sen("s4-f", [
            cari("1", "ABC"), borc("2", "F", "ABC", "1000"),
            al("3", "Z1", "ABC", "1500", "02.10.2026"), al("4", "S1", "ABC", "600", "02.10.2026"),
            al("5", "Z2", "ABC", "500", "03.10.2026"), al("6", "S2", "ABC", "400", "03.10.2026"),
            al("7", "Z3", "ABC", "1", "04.10.2026"),
        ]))
        self.assertEqual(self.retler(o), [("3", 400, "doubtful-exceeds-balance"), ("5", 400, "doubtful-exceeds-balance"),
                                          ("7", 400, "doubtful-exceeds-balance")])
        self.assertEqual((m(o, "128"), m(o, "120"), o["cariler"]["ABC"]), (100000, 0, 100000))
        self.assertEqual(set(o["supheliAlacaklar"]), {"S1", "S2"})

    def test_g_karsilik_supheliyi_asar(self):
        """KABUL G: al 1.000 → karşılık 1.200 → 400 doubtful-provision-exceeds; 700 ✓; 400 → 400; 300 ✓ → 129 = −1.000, 654 = 1.000."""
        o = self.ikisi(sen("s4-g", [
            cari("1", "ABC"), borc("2", "F", "ABC", "1000"), al("3", "S", "ABC", "1000", "02.10.2026"),
            karsilik("4", "S", "1200", "03.10.2026"), karsilik("5", "S", "700", "03.10.2026"),
            karsilik("6", "S", "400", "04.10.2026"), karsilik("7", "S", "300", "04.10.2026"),
        ]))
        self.assertEqual(self.retler(o), [("4", 400, "doubtful-provision-exceeds"), ("6", 400, "doubtful-provision-exceeds")])
        self.assertEqual((m(o, "129"), m(o, "654"), m(o, "128")), (-100000, 100000, 100000))
        self.assertEqual(o["supheliAlacaklar"]["S"], sup(100000, karsilik_=100000))

    def test_h_karsiliksiz_evrak_kisayolu(self):
        """KABUL H: borç 1.000 → çek 1.000 alındı (cari 0; 101.01 1.000) → kısayol portföydeyken 409 (kodsuz) → karşılıksız (cari 1.000)
        → al (evrak) → neden Karşılıksız Çek, tutar 1.000: 128 = 1.000, 120 = 0, 101.01 = 0."""
        o = self.ikisi(sen("s4-h", [
            cari("1", "ABC"), borc("2", "F", "ABC", "1000"),
            {"id": "3", "islem": "evrak_al", "ad": "C", "tur": "cek", "cari": "ABC", "tutar": "1000", "tarih": "02.10.2026"},
            al("4", "Z", "ABC", None, "03.10.2026", evrak="C"),
            {"id": "5", "islem": "evrak_karsiliksiz", "evrak": "C", "tarih": "05.10.2026"}, {"id": "k", "islem": "kontrol"},
            al("6", "S", "ABC", None, "06.10.2026", evrak="C"),
        ]))
        self.assertEqual(self.retler(o), [("4", 409, None)])
        self.assertEqual(o["araDurumlar"]["k"]["cariler"]["ABC"], 100000)
        self.assertEqual((m(o, "128"), m(o, "120"), m(o, "101.01"), o["cariler"]["ABC"]), (100000, 0, 0, 100000))
        self.assertEqual(o["supheliAlacaklar"]["S"], sup(100000))
        self.assertNotIn("Z", o["supheliAlacaklar"])

    def test_u_w_degersiz_asan_ve_tedarikci(self):
        """KABUL U: al 1.000 → değersiz 1.200 → 400 doubtful-writeoff-exceeds. KABUL W: tedarikçi carisine al → 409 doubtful-customer-only."""
        o = self.ikisi(sen("s4-uw", [
            cari("1", "ABC"), cari("2", "TED", "tedarikci"), borc("3", "F", "ABC", "1000"),
            al("4", "S", "ABC", "1000", "02.10.2026"), degersiz("5", "S", "1200", "03.10.2026"),
            {"id": "6", "islem": "fatura", "ad": "FA", "tur": "alis", "cari": "TED", "tarih": "01.10.2026",
             "kalemler": [{"hizmet": "Banka", "miktar": 1, "birimFiyat": "500", "kdvOrani": 20, "kdvDahil": True, "giderTuru": "Banka Masrafları"}]},
            al("7", "Z", "TED", "100", "02.10.2026"),
        ]))
        self.assertEqual(self.retler(o), [("5", 400, "doubtful-writeoff-exceeds"), ("7", 409, "doubtful-customer-only")])
        self.assertEqual((m(o, "128"), m(o, "659"), m(o, "320")), (100000, 0, -50000))

    def test_i_kilit_j_ileri_tarih_date_before_record(self):
        """KABUL I/J: kayıt 05.10 → kilit 06.10 → al (05.10) 409 period-locked; karşılık (06.10) 409 period-locked; sil (kilitli kayıt) 409;
        al (13.10) 400 ileri tarih; karşılık kayıt tarihinden önce (07.10 kayıt, 06.10 karşılık — kilit sonrası 07.10'luk kayıtla) → kilit de
        var: tek ihlal olsun diye kilitsiz ayrı senaryo. Hiçbir ret deftere yazmaz."""
        o = self.ikisi(sen("s4-i", [
            cari("1", "ABC"), borc("2", "F", "ABC", "5000"), al("3", "S", "ABC", "1000", "05.10.2026"),
            {"id": "4", "islem": "donem_kilidi", "kilitTarihi": "06.10.2026"},
            al("5", "Z1", "ABC", "100", "05.10.2026"), karsilik("6", "S", "100", "06.10.2026"),
            {"id": "7", "islem": "sil", "hedef": "S"}, al("8", "Z2", "ABC", "100", "13.10.2026"),
            al("9", "S2", "ABC", "100", "07.10.2026"),
        ]))
        self.assertEqual(self.retler(o), [("5", 409, "period-locked"), ("6", 409, "period-locked"), ("7", 409, "period-locked"),
                                          ("8", 400, None)])
        self.assertEqual((m(o, "128"), m(o, "129")), (110000, 0))
        o = self.ikisi(sen("s4-j", [
            cari("1", "ABC"), borc("2", "F", "ABC", "5000"), al("3", "S", "ABC", "1000", "07.10.2026"),
            karsilik("4", "S", "100", "06.10.2026"), degersiz("5", "S", "100", "06.10.2026"), cikar("6", "S", "06.10.2026"),
        ]))
        self.assertEqual(self.retler(o), [("4", 400, "date-before-record"), ("5", 400, "date-before-record"), ("6", 400, "date-before-record")])
        self.assertEqual(o["supheliAlacaklar"]["S"], sup(100000))

    def test_q_yetki_ve_istek_kimligi(self):
        """KABUL Q: personel 403; muhasebe 200. KABUL K: aynı istek kimliği + aynı gövde → yineleme (tek kayıt); farklı gövde → 409."""
        o = self.ikisi(sen("s4-q", [
            cari("1", "ABC"), borc("2", "F", "ABC", "5000"),
            al("3", "Z", "ABC", "1000", "02.10.2026", kullanici="PE"),
            al("4", "S", "ABC", "1000", "02.10.2026", kullanici="MU", istekKimligi="ik-1"),
            al("5", "S2", "ABC", "1000", "02.10.2026", kullanici="MU", istekKimligi="ik-1"),
            al("6", "Z2", "ABC", "1500", "02.10.2026", kullanici="MU", istekKimligi="ik-1"),
            karsilik("7", "S", "100", "03.10.2026", kullanici="PE"),
        ], kullanicilar={"MU": "muhasebe", "PE": "personel"}))
        self.assertEqual(self.retler(o), [("3", 403, None), ("6", 409, None), ("7", 403, None)])
        self.assertEqual(o["yinelenenler"], ["5"])
        self.assertEqual(m(o, "128"), 100000)
        self.assertEqual(o["supheliAlacaklar"], {"S": sup(100000), "S2": sup(100000)})

    def test_sil_kayit_ve_karsilik(self):
        """§4.28 sürüm 4 (KABUL L): al 4.000 → sil → 128 = 0, cari 10.000; ikinci sil 404; karşılık (ad) → sil → 129 = 0, 654 = 0;
        silinen karşılığın 644'ü de kalkar (tahsilat sonrası). Sil, yetkisiz personelde 403."""
        o = self.ikisi(sen("s4-sil", [
            cari("1", "ABC"), borc("2", "F", "ABC", "10000"),
            al("3", "S", "ABC", "4000", "02.10.2026"), {"id": "k1", "islem": "kontrol"},
            {"id": "4", "islem": "sil", "hedef": "S"}, {"id": "k2", "islem": "kontrol"},
            {"id": "5", "islem": "sil", "hedef": "S"},
            al("6", "S2", "ABC", "4000", "03.10.2026"), karsilik("7", "S2", "2500", "04.10.2026", ad="KR"),
            tahsilat("8", "ABC", "3000", "05.10.2026"), {"id": "k3", "islem": "kontrol"},
            {"id": "9", "islem": "sil", "hedef": "KR", "kullanici": "PE"},
            {"id": "10", "islem": "sil", "hedef": "KR"},
        ], kullanicilar={"PE": "personel"}))
        k1, k2, k3 = (o["araDurumlar"][k] for k in ("k1", "k2", "k3"))
        self.assertEqual((m(k1, "128"), k1["cariler"]["ABC"]), (400000, 1000000))
        self.assertEqual((m(k2, "128"), k2["cariler"]["ABC"], k2["supheliAlacaklar"]), (0, 1000000, {}))
        self.assertEqual((m(k3, "128"), m(k3, "129"), m(k3, "644"), m(k3, "654")), (100000, -100000, -150000, 250000))
        self.assertEqual(self.retler(o), [("5", 404, None), ("9", 403, None)])
        self.assertEqual((m(o, "128"), m(o, "129"), m(o, "644"), m(o, "654"), o["cariler"]["ABC"]), (100000, 0, 0, 0, 700000))
        self.assertEqual(o["supheliAlacaklar"], {"S2": sup(400000, tahsil=300000)})

    def test_k3_evrak_ve_iade_alacak_satiri(self):
        """KABUL K3: alınan evrak ve satıştan iade de şüpheliden düşer. Borç 5.000 → al 2.000 (02.10) → çek 1.500 alındı (03.10):
        A 128 1.500 → 128 500, 101.01 1.500, 120 3.000, cari 3.500. İade: satış 2.000 hariç (T 2.400) → al 1.000 → iade 1 kalem (acik):
        A 128 1.000 + A 120 1.400 → 128 0, 120 0, cari 0 (faturalar.*.acik BELİRSİZ-27 / iade kuralıyla; karşılaştırılmaz)."""
        o = self.ikisi(sen("s4-k3", [
            cari("1", "ABC"), borc("2", "F", "ABC", "5000"), al("3", "S", "ABC", "2000", "02.10.2026"),
            {"id": "4", "islem": "evrak_al", "ad": "C", "tur": "cek", "cari": "ABC", "tutar": "1500", "tarih": "03.10.2026"},
        ]))
        self.assertEqual((m(o, "128"), m(o, "101.01"), m(o, "120"), o["cariler"]["ABC"]), (50000, 150000, 300000, 350000))
        self.assertEqual(o["supheliAlacaklar"]["S"], sup(200000, tahsil=150000))
        o = self.ikisi(sen("s4-k3b", [
            cari("1", "ABC"), borc("2", "F", "ABC", "2000", dahil=False), al("3", "S", "ABC", "1000", "02.10.2026"),
            {"id": "4", "islem": "iade", "ad": "R", "asilFatura": "F", "tarih": "03.10.2026", "kalemler": [{"kalem": 1, "miktar": 1}],
             "geri": {"yol": "acik"}},
        ]))
        self.assertEqual((m(o, "128"), m(o, "120"), o["cariler"]["ABC"], m(o, "610")), (0, 0, 0, 200000))
        self.assertEqual(o["supheliAlacaklar"]["S"], sup(100000, tahsil=100000))


class K8Taksit(IkiModel):
    def test_k8_plan_paid_overpay_fazla_avans(self):
        """§4.17 K8 [PLAN §3.10/3]: kart 1.200 (2 taksit); 1.000 nakit → kalan 200; 500 → 409 plan-overpay; PE fazlaAvans 500 → 403
        plan-overpay-permission; Y fazlaAvans 500 → yazılır: odenen 1.500, kalan 0, cari 1.200 − 1.500 = −300, faturalar.F.acik BELİRSİZ-34;
        100 → 409 plan-paid; Y fazlaAvans 100 (kalan 0) → odenen 1.600, cari −400; Kasa 1.600."""
        o = self.ikisi(sen("s4-k8", [
            cari("1", "ABC"),
            borc("2", "F", "ABC", "1200", odeme={"taksit": {"ad": "T1", "sayi": 2}}),
            {"id": "3", "islem": "taksit_tahsilat", "ad": "H1", "kart": "T1", "tutar": "1000", "yol": "nakit", "tarih": "02.10.2026"},
            {"id": "4", "islem": "taksit_tahsilat", "kart": "T1", "tutar": "500", "yol": "nakit", "tarih": "03.10.2026"},
            {"id": "5", "islem": "taksit_tahsilat", "kart": "T1", "tutar": "500", "yol": "nakit", "tarih": "03.10.2026", "fazlaAvans": True,
             "kullanici": "PE"},
            {"id": "6", "islem": "taksit_tahsilat", "ad": "H2", "kart": "T1", "tutar": "500", "yol": "nakit", "tarih": "03.10.2026",
             "fazlaAvans": True},
            {"id": "k1", "islem": "kontrol"},
            {"id": "7", "islem": "taksit_tahsilat", "kart": "T1", "tutar": "100", "yol": "nakit", "tarih": "04.10.2026"},
            {"id": "8", "islem": "taksit_tahsilat", "kart": "T1", "tutar": "100", "yol": "nakit", "tarih": "04.10.2026", "fazlaAvans": True},
        ], kullanicilar={"PE": "personel"}))
        self.assertEqual(self.retler(o), [("4", 409, "plan-overpay"), ("5", 403, "plan-overpay-permission"), ("7", 409, "plan-paid")])
        k1 = o["araDurumlar"]["k1"]
        self.assertEqual(k1["taksitKartlari"]["T1"], {"toplam": 120000, "odenen": 150000, "kalan": 0})
        self.assertEqual((k1["cariler"]["ABC"], k1["kasa"]), (-30000, 150000))
        self.assertEqual(o["taksitKartlari"]["T1"], {"toplam": 120000, "odenen": 160000, "kalan": 0})
        self.assertEqual((o["cariler"]["ABC"], o["kasa"], m(o, "120")), (-40000, 160000, -40000))
        yollar = {x["alan"] for x in o["belirsizler"]}
        self.assertEqual(yollar, {"faturalar.F.acik", "araDurumlar.k1.faturalar.F.acik"})

    def test_k8_silme_sonrasi_yeniden_acilir(self):
        """Fazla tahsilat silinince kart yeniden açılır: 1.000 + fazlaAvans 500 → sil 500 → kalan 200; 200 → yazılır (kalan 0); 1 → plan-paid."""
        o = self.ikisi(sen("s4-k8s", [
            cari("1", "ABC"),
            borc("2", "F", "ABC", "1200", odeme={"taksit": {"ad": "T1", "sayi": 2}}),
            {"id": "3", "islem": "taksit_tahsilat", "kart": "T1", "tutar": "1000", "yol": "nakit", "tarih": "02.10.2026"},
            {"id": "4", "islem": "taksit_tahsilat", "ad": "H2", "kart": "T1", "tutar": "500", "yol": "nakit", "tarih": "03.10.2026",
             "fazlaAvans": True},
            {"id": "5", "islem": "sil", "hedef": "H2"},
            {"id": "6", "islem": "taksit_tahsilat", "kart": "T1", "tutar": "200", "yol": "nakit", "tarih": "04.10.2026"},
            {"id": "7", "islem": "taksit_tahsilat", "kart": "T1", "tutar": "1", "yol": "nakit", "tarih": "04.10.2026"},
        ]))
        self.assertEqual(self.retler(o), [("7", 409, "plan-paid")])
        self.assertEqual(o["taksitKartlari"]["T1"], {"toplam": 120000, "odenen": 120000, "kalan": 0})
        self.assertEqual((o["cariler"]["ABC"], o["faturalar"]["F"]["acik"], o["belirsizler"]), (0, 0, []))


class Gecersizler(IkiModel):
    def test_surum3_dilinde_supheli_gecersiz(self):
        self.ikisi_gecersiz(sen("s4-g1", [cari("1", "ABC"), borc("2", "F", "ABC", "1"), al("3", "S", "ABC", "1", "02.10.2026")],
                                dil="destekofis-senaryo/3"), "sürüm 4")
        self.ikisi_gecersiz(sen("s4-g2", [cari("1", "ABC"), borc("2", "F", "ABC", "1", odeme={"taksit": {"ad": "T", "sayi": 1}}),
                                          {"id": "3", "islem": "taksit_tahsilat", "kart": "T", "tutar": "2", "yol": "nakit", "fazlaAvans": True}],
                                dil="destekofis-senaryo/3"), "sürüm 4")

    def test_belirsiz_35_gun_sirasi(self):
        taban = [cari("1", "ABC"), borc("2", "F", "ABC", "5000")]
        self.ikisi_gecersiz(sen("s4-g3", taban + [tahsilat("3", "ABC", "100", "02.10.2026"), al("4", "S", "ABC", "1000", "02.10.2026")]),
                            "BELİRSİZ-35")
        self.ikisi_gecersiz(sen("s4-g4", taban + [al("3", "S", "ABC", "1000", "02.10.2026"), degersiz("4", "S", "100", "03.10.2026"),
                                                  tahsilat("5", "ABC", "100", "03.10.2026")]), "BELİRSİZ-35")
        self.ikisi_gecersiz(sen("s4-g5", taban + [al("3", "S", "ABC", "1000", "02.10.2026"), cikar("4", "S", "03.10.2026"),
                                                  tahsilat("5", "ABC", "100", "03.10.2026")]), "BELİRSİZ-35")

    def test_belirsiz_33_37_38(self):
        taban = [cari("1", "ABC"), borc("2", "F", "ABC", "5000")]
        self.ikisi_gecersiz(sen("s4-g6", taban + [al("3", "S", "ABC", "1000", "02.10.2026"), karsilik("4", "S", "100", "03.10.2026"),
                                                  {"id": "5", "islem": "sil", "hedef": "S"}]), "BELİRSİZ-37")
        self.ikisi_gecersiz(sen("s4-g7", taban + [al("3", "S", "ABC", "1000", "02.10.2026"),
                                                  borc("4", "F2", "ABC", "100", tarih="03.10.2026",
                                                       odeme={"pesin": [{"yol": "nakit", "tutar": "50"}]})]), "BELİRSİZ-38")
        self.ikisi_gecersiz(sen("s4-g8", [cari("1", "ABC"), borc("2", "F", "ABC", "1200", odeme={"taksit": {"ad": "T", "sayi": 2}}),
                                          {"id": "3", "islem": "taksit_tahsilat", "kart": "T", "tutar": "100", "yol": "nakit"},
                                          {"id": "4", "islem": "taksit_tahsilat", "kart": "T", "tutar": "100", "yol": "nakit", "taksitNo": 2}]),
                            "BELİRSİZ-33")
        self.ikisi_gecersiz(sen("s4-g9", [cari("1", "ABC"), borc("2", "F", "ABC", "1200", odeme={"taksit": {"ad": "T", "sayi": 2}}),
                                          {"id": "3", "islem": "taksit_tahsilat", "kart": "T", "tutar": "100", "yol": "nakit", "fazlaAvans": True}]),
                            "BELİRSİZ-33")


class OzetliKosucu(unittest.TextTestRunner):
    def run(self, test):
        r = super().run(test)
        kalan = len(r.failures) + len(r.errors)
        sys.stderr.write("%d geçti, %d kaldı\n" % (r.testsRun - kalan, kalan))
        return r


if __name__ == "__main__":
    unittest.main(testRunner=OzetliKosucu)
