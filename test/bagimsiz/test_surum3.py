#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""SENARYO-DILI sürüm 3 (evrak: çek ve senet, Bankaya Tahsile Ver — plan §3.11a, §3.14) iki kâhinde ortak testi.

Koşu:  python3 -I test/bagimsiz/test_surum3.py -v

Her test aynı senaryoyu model_a ve model_b'ye komut satırından verir (python3 -I model.py <senaryo>) ve sonucu elle
hesaplanmış beklenenle karşılaştırır. Beklenen sayılar SENARYO-DILI.md §4.30–4.38 ve plan §3.7 #9, §3.11 madde 5, §3.11a,
§3.11b/1, §3.14 kurallarından elle hesaplandı (hesap her testin yorumunda); kâhinlerin ya da programın çıktısından kopyalanmadı.
Temiz oda: bu dosya programın kodunu okumaz.
"""

import json
import os
import subprocess
import sys
import tempfile
import unittest

BURASI = os.path.dirname(os.path.abspath(__file__))
MODELLER = {"a": os.path.join(BURASI, "model_a", "model.py"), "b": os.path.join(BURASI, "model_b", "model.py")}
DIL = "destekofis-senaryo/3"


def sen(ad, adimlar, bugun="12.10.2026", ayarlar=None, dil=DIL):
    b = {"bugun": bugun, "sirket": "bos", "ayarlar": ayarlar or {"kasaEksiBakiye": "uyar"}}
    return {"dil": dil, "ad": ad, "baslangic": b, "adimlar": adimlar}


def kos(model, s):
    with tempfile.TemporaryDirectory() as d:
        yol = os.path.join(d, s["ad"] + ".json")
        with open(yol, "w", encoding="utf-8") as fh:
            json.dump(s, fh, ensure_ascii=False)
        p = subprocess.run([sys.executable, "-I", MODELLER[model], yol], capture_output=True, text=True)
        return p.returncode, (json.loads(p.stdout) if p.returncode == 0 else None), p.stderr


def hesap(aid, ad, tutar, tur="vadesiz", dog=True, acilis="01.10.2026", **kw):
    a = {"id": aid, "islem": "hesap_ac", "ad": ad, "banka": "Banka " + ad, "hesapAdi": "Hesap " + ad, "tur": tur,
         "paraBirimi": "TRY", "acilisTarihi": acilis, "acilisBakiyesi": tutar, "bakiyeDogrulandi": dog}
    a.update(kw)
    return a


def cari(aid, ad, tur="musteri"):
    return {"id": aid, "islem": "cari_ac", "ad": ad, "unvan": ad + " Ltd.", "tur": tur}


def al(aid, ad, c, tutar, tarih, tur="cek", **kw):
    a = {"id": aid, "islem": "evrak_al", "ad": ad, "tur": tur, "cari": c, "tutar": tutar, "tarih": tarih}
    a.update(kw)
    return a


def ver(aid, ad, c, tutar, tarih, tur="cek", **kw):
    a = {"id": aid, "islem": "evrak_ver", "ad": ad, "tur": tur, "cari": c, "tutar": tutar, "tarih": tarih}
    a.update(kw)
    return a


def op(aid, islem, evrak, tarih=None, **kw):
    a = {"id": aid, "islem": islem, "evrak": evrak}
    if tarih:
        a["tarih"] = tarih
    a.update(kw)
    return a


def m(o, kod):
    x = o["mizan"].get(kod, {"borc": 0, "alacak": 0})
    return x["borc"] - x["alacak"]


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


class KabulSenet(IkiModel):
    def test_kabul_senet_plan_sayilari_ve_retler(self):
        """senaryolar/kabul-senet.json: üç kontrol adımının planBeklenen'i (59 yaprak, plan kurallarından elle) ve 11 ret."""
        with open(os.path.join(BURASI, "senaryolar", "kabul-senet.json"), encoding="utf-8") as fh:
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
                for p in yol:
                    g = g.get(p, {"borc": 0, "alacak": 0}) if yol[0] == "mizan" and isinstance(g, dict) else g[p]
                self.assertEqual(g, beklenen, "%s %s" % (adim["id"], "/".join(yol)))
                n += 1
        self.assertEqual(n, 59)
        self.assertEqual(self.retler(o), [
            ("16", 409, "cheque-deposited"), ("17", 409, "cheque-deposited"), ("18", 400, None), ("25", "4xx", None),
            ("26", "4xx", None), ("28", 400, "bank-account-invalid"), ("29", "4xx", None), ("31", 404, None),
            ("33", 400, "bank-account-required"), ("36", 409, "period-locked"), ("39", 409, "period-locked")])


class Hesaplar(IkiModel):
    def test_tahsildeki_senet_karsiliksiz_121_02den(self):
        """Senet 7.000 alındı (B 121.01 / A 120), tahsile verildi (B 121.02 / A 121.01), karşılıksız: B 120 / A 121.02
        [PLAN §3.14 "A 101.02"; §3.11a 121.02]. Son: 121.01 = 0, 121.02 = 0, cari 0, banka değişmez (100.000)."""
        o = self.ikisi(sen("s3-a", [
            hesap("1", "ZIR", "100000"), cari("2", "M"),
            al("3", "S", "M", "7000", "02.10.2026", tur="senet"),
            op("4", "tahsile_ver", "S", "05.10.2026", hesap="ZIR"),
            {"id": "k", "islem": "kontrol"},
            op("5", "evrak_karsiliksiz", "S", "06.10.2026"),
        ]))
        self.assertEqual(m(o["araDurumlar"]["k"], "121.02"), 700000)
        self.assertEqual(m(o["araDurumlar"]["k"], "121.01"), 0)
        self.assertEqual(m(o, "121.01"), 0)
        self.assertEqual(m(o, "121.02"), 0)
        self.assertEqual(o["cariler"]["M"], 0)
        self.assertEqual(o["bankaHesaplari"]["ZIR"], 10000000)
        self.assertNotIn("101.01", o["mizan"])

    def test_geri_al_sonra_yeniden_tahsile_ver_ve_tahsil(self):
        """Çek 4.000: tahsile ver (ZIR) → geri al → tahsile ver (GAR) → tahsil (hesap verilmez → GAR) [PLAN §3.11 'en çok bir
        etkin kayıt'; §3.14 'hesap tahsil kaydının hesabıyla ön seçili']. Son: GAR 50.000 + 4.000, ZIR değişmez."""
        o = self.ikisi(sen("s3-b", [
            hesap("1", "ZIR", "100000"), hesap("2", "GAR", "50000", tur="ticari"), cari("3", "M"),
            al("4", "C", "M", "4000", "02.10.2026"),
            op("5", "tahsile_ver", "C", "05.10.2026", hesap="ZIR"),
            op("6", "bankadan_geri_al", "C", "06.10.2026"),
            op("7", "tahsile_ver", "C", "07.10.2026", hesap="GAR"),
            op("8", "evrak_tahsil", "C", "08.10.2026", yol="havale"),
        ]))
        self.assertEqual(o["bankaHesaplari"], {"ZIR": 10000000, "GAR": 5400000})
        self.assertEqual((m(o, "101.01"), m(o, "101.02")), (0, 0))
        self.assertEqual(o["cariler"]["M"], -400000)
        self.assertEqual(o["retler"], [])

    def test_hesapsiz_tahsil_102_00_ve_odeme_nakit(self):
        """Hiç banka hesabı yok: çek tahsili havale → 102.00 [§5.2/1; PLAN §3.5/1]; verilen senet nakit ödendi: B 321 / A 100."""
        o = self.ikisi(sen("s3-c", [
            cari("1", "M"), cari("2", "T", "tedarikci"),
            {"id": "3", "islem": "kasa_acilis", "tutar": "5000", "tarih": "01.10.2026"},
            al("4", "C", "M", "1500", "02.10.2026"),
            op("5", "evrak_tahsil", "C", "03.10.2026", yol="havale"),
            ver("6", "V", "T", "2000", "02.10.2026", tur="senet"),
            op("7", "evrak_odeme", "V", "04.10.2026", yol="nakit"),
        ]))
        self.assertEqual(m(o, "102.00"), 150000)
        self.assertEqual(o["ozet"]["hesabiAtanmamis"], 150000)
        self.assertEqual(o["kasa"], 300000)
        self.assertEqual((m(o, "321"), m(o, "103"), m(o, "101.01")), (0, 0, 0))
        self.assertEqual(o["cariler"], {"M": -150000, "T": 200000})

    def test_ciro_senet_ve_silme(self):
        """Senet 900 alındı, tedarikçiye ciro: B 320 / A 121.01 [YAYGIN]; ikinci çek alınıp silindi → satırları kalkar."""
        o = self.ikisi(sen("s3-d", [
            cari("1", "M"), cari("2", "T", "tedarikci"),
            al("3", "S", "M", "900", "02.10.2026", tur="senet"),
            {"id": "4", "islem": "evrak_ciro", "evrak": "S", "cari": "T", "tarih": "03.10.2026"},
            al("5", "C", "M", "300", "02.10.2026"),
            op("6", "evrak_sil", "C"),
        ]))
        self.assertEqual(o["cariler"], {"M": -90000, "T": 90000})
        self.assertEqual(m(o, "121.01"), 0)
        self.assertEqual(m(o, "101.01"), 0)
        self.assertEqual(o["retler"], [])


class Retler(IkiModel):
    def test_eksi_bakiye_engelle_odemede(self):
        """ZIR 1.000, Engelle; verilen çek 1.500 havale ile ödenirse ZIR −500 → 409 cash-blocked [§5.3; PLAN §3.9]."""
        o = self.ikisi(sen("s3-e", [
            hesap("1", "ZIR", "1000"), {"id": "2", "islem": "hesap_eksi_politika", "hesap": "ZIR", "politika": "engelle"},
            cari("3", "T", "tedarikci"), ver("4", "V", "T", "1500", "02.10.2026"),
            op("5", "evrak_odeme", "V", "03.10.2026", yol="havale"),
        ]))
        self.assertEqual(self.retler(o), [("5", 409, "cash-blocked")])
        self.assertEqual(m(o, "103"), -150000)

    def test_tahsile_ver_acilistan_once_ve_pasif_hesap(self):
        """YEN hesabı 06.10'da açıldı; 04.10 tarihli tahsile verme → 4xx bank-before-opening [ÇIKARIM]; pasif hesaba → 400
        bank-account-invalid [ÇIKARIM §5.2/4]."""
        o = self.ikisi(sen("s3-f", [
            hesap("1", "YEN", "100", acilis="06.10.2026"), hesap("2", "ESK", "100"),
            {"id": "3", "islem": "hesap_durum", "hesap": "ESK", "durum": "pasif"},
            cari("4", "M"), al("5", "C", "M", "100", "02.10.2026"),
            op("6", "tahsile_ver", "C", "04.10.2026", hesap="YEN"),
            op("7", "tahsile_ver", "C", "07.10.2026", hesap="ESK"),
        ]))
        self.assertEqual(self.retler(o), [("6", "4xx", "bank-before-opening"), ("7", 400, "bank-account-invalid")])
        self.assertEqual(m(o, "101.01"), 10000)

    def test_ileri_tarih_ve_atlanan(self):
        """İleri tarihli evrak alışı 400 [PLAN §11.1 A6]; o evrakı anan adım atlanır (§8.5)."""
        o = self.ikisi(sen("s3-g", [
            cari("1", "M"), al("2", "C", "M", "100", "13.10.2026"),
            op("3", "evrak_karsiliksiz", "C", "12.10.2026"),
        ]))
        self.assertEqual(self.retler(o), [("2", 400, None)])
        self.assertEqual(o["atlananlar"], ["3"])
        self.assertEqual(o["cariler"]["M"], 0)

    def test_tahsil_edilmis_evrak_islem_gormez(self):
        """Tahsil edilmiş çeke karşılıksız, tahsile ver, ikinci tahsil → 4xx [YAYGIN; PLAN §3.14 'yalnız portföydeki']."""
        o = self.ikisi(sen("s3-h", [
            cari("1", "M"), {"id": "2", "islem": "kasa_acilis", "tutar": "10", "tarih": "01.10.2026"},
            hesap("3", "ZIR", "10"),
            al("4", "C", "M", "100", "02.10.2026"), op("5", "evrak_tahsil", "C", "03.10.2026", yol="nakit"),
            op("6", "evrak_karsiliksiz", "C", "04.10.2026"),
            op("7", "tahsile_ver", "C", "04.10.2026", hesap="ZIR"),
            op("8", "evrak_tahsil", "C", "04.10.2026", yol="nakit"),
        ]))
        self.assertEqual(self.retler(o), [("6", "4xx", None), ("7", "4xx", None), ("8", "4xx", None)])
        self.assertEqual(o["kasa"], 11000)


class Belirsizler(IkiModel):
    def test_evrakli_carinin_fatura_acigi_belirsiz_taksit_karti_degil(self):
        """BELİRSİZ-27: evrak satırı olan carinin faturalar.*.acik alanı karşılaştırılmaz; taksit kartı karşılaştırılır."""
        o = self.ikisi(sen("s3-i", [
            cari("1", "M"),
            {"id": "2", "islem": "fatura", "ad": "F1", "tur": "satis", "cari": "M", "tarih": "02.10.2026",
             "kalemler": [{"hizmet": "Danışmanlık", "miktar": 1, "birimFiyat": "1000", "kdvOrani": 20, "kdvDahil": False}]},
            {"id": "3", "islem": "fatura", "ad": "F2", "tur": "satis", "cari": "M", "tarih": "02.10.2026",
             "kalemler": [{"hizmet": "Danışmanlık", "miktar": 1, "birimFiyat": "500", "kdvOrani": 20, "kdvDahil": False}],
             "odeme": {"taksit": {"ad": "T2", "sayi": 2}}},
            al("4", "C", "M", "1200", "03.10.2026"),
        ]))
        yollar = {x["alan"]: x["neden"] for x in o["belirsizler"]}
        self.assertIn("faturalar.F1.acik", yollar)
        self.assertTrue(yollar["faturalar.F1.acik"].startswith("BELİRSİZ-27"))
        self.assertFalse(any(y.startswith("taksitKartlari.") for y in yollar))
        self.assertEqual(o["taksitKartlari"]["T2"], {"toplam": 60000, "odenen": 0, "kalan": 60000})
        self.assertEqual(o["cariler"]["M"], 120000 + 60000 - 120000)

    def test_surum2_senaryosunda_evrak_gecersiz(self):
        self.ikisi_gecersiz(sen("s3-j", [cari("1", "M"), al("2", "C", "M", "1", "02.10.2026")],
                                dil="destekofis-senaryo/2"), "sürüm 3")

    def test_tahsildeki_evrakin_nakit_tahsili_belirsiz29(self):
        self.ikisi_gecersiz(sen("s3-k", [
            hesap("1", "ZIR", "1"), cari("2", "M"), al("3", "C", "M", "1", "02.10.2026"),
            op("4", "tahsile_ver", "C", "03.10.2026", hesap="ZIR"),
            op("5", "evrak_tahsil", "C", "04.10.2026", yol="nakit")]), "BELİRSİZ-29")

    def test_veren_cariye_ciro_ve_vadeli_hesap_belirsiz30(self):
        self.ikisi_gecersiz(sen("s3-l", [
            cari("1", "M"), al("2", "C", "M", "1", "02.10.2026"),
            {"id": "3", "islem": "evrak_ciro", "evrak": "C", "cari": "M", "tarih": "03.10.2026"}]), "BELİRSİZ-30")
        self.ikisi_gecersiz(sen("s3-m", [
            hesap("1", "VAD", "1", tur="vadeli"), cari("2", "M"), al("3", "C", "M", "1", "02.10.2026"),
            op("4", "tahsile_ver", "C", "03.10.2026", hesap="VAD")]), "BELİRSİZ-30")

    def test_vadeden_once_tahsil_ve_geri_alma_sirasi_belirsiz28(self):
        self.ikisi_gecersiz(sen("s3-n", [
            cari("1", "M"), al("2", "C", "M", "1", "02.10.2026", vade="10.10.2026"),
            op("3", "evrak_tahsil", "C", "05.10.2026", yol="nakit")]), "BELİRSİZ-28")
        self.ikisi_gecersiz(sen("s3-o", [
            hesap("1", "ZIR", "1"), cari("2", "M"), al("3", "C", "M", "1", "02.10.2026"),
            op("4", "tahsile_ver", "C", "06.10.2026", hesap="ZIR"),
            op("5", "bankadan_geri_al", "C", "05.10.2026")]), "BELİRSİZ-28")

    def test_gecmisli_evrakin_silinmesi_belirsiz31(self):
        self.ikisi_gecersiz(sen("s3-p", [
            hesap("1", "ZIR", "1"), cari("2", "M"), al("3", "C", "M", "1", "02.10.2026"),
            op("4", "tahsile_ver", "C", "03.10.2026", hesap="ZIR"),
            op("5", "bankadan_geri_al", "C", "04.10.2026"),
            op("6", "evrak_sil", "C")]), "BELİRSİZ-31")


if __name__ == "__main__":
    unittest.main()
