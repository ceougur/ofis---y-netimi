#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""SENARYO-DILI sürüm 2 değişikliklerinin (D1–D7) iki kâhinde ortak testi (unittest, yalnız standart kütüphane).

Koşu:  python3 -I test/bagimsiz/test_surum2.py -v

Her test aynı senaryoyu model_a ve model_b'ye komut satırından verir (python3 -I model.py <senaryo>) ve sonucu elle
hesaplanmış beklenenle karşılaştırır. Beklenen sayılar SENARYO-DILI.md sürüm 2 kurallarından elle hesaplandı (hesap her
testin yorumunda); kâhinlerin ya da programın çıktısından kopyalanmadı. Temiz oda: bu dosya programın kodunu okumaz.
"""

import json
import os
import subprocess
import sys
import tempfile
import unittest

BURASI = os.path.dirname(os.path.abspath(__file__))
MODELLER = {"a": os.path.join(BURASI, "model_a", "model.py"), "b": os.path.join(BURASI, "model_b", "model.py")}
DIL = "destekofis-senaryo/2"


def sen(ad, adimlar, bugun="08.10.2026", ayarlar=None, kullanicilar=None):
    b = {"bugun": bugun, "sirket": "bos"}
    if ayarlar:
        b["ayarlar"] = ayarlar
    if kullanicilar:
        b["kullanicilar"] = kullanicilar
    return {"dil": DIL, "ad": ad, "baslangic": b, "adimlar": adimlar}


def kos(model, s):
    """(çıkış kodu, çıktı ya da None, stderr)."""
    with tempfile.TemporaryDirectory() as d:
        yol = os.path.join(d, s["ad"] + ".json")
        with open(yol, "w", encoding="utf-8") as fh:
            json.dump(s, fh, ensure_ascii=False)
        p = subprocess.run([sys.executable, "-I", MODELLER[model], yol], capture_output=True, text=True)
        return p.returncode, (json.loads(p.stdout) if p.returncode == 0 else None), p.stderr


def cari(aid, ad, tur="musteri"):
    return {"id": aid, "islem": "cari_ac", "ad": ad, "unvan": ad + " Ltd.", "tur": tur}


def hizmet(aid, ad, tur, c, fiyat, tarih, miktar=1, odeme=None, **kw):
    """Hizmet kalemi, KDV %20 HARİÇ: matrah = miktar × fiyat, KDV = %20, toplam = 1,2 × matrah."""
    k = {"hizmet": "Danışmanlık", "miktar": miktar, "birimFiyat": fiyat, "kdvOrani": 20, "kdvDahil": False}
    if tur == "alis":
        k["giderTuru"] = "Banka Masrafları"
    a = {"id": aid, "islem": "fatura", "ad": ad, "tur": tur, "cari": c, "kalemler": [k], "tarih": tarih}
    if odeme:
        a["odeme"] = odeme
    a.update(kw)
    return a


def iade(aid, ad, asil, tarih, miktar=1, geri=None):
    return {"id": aid, "islem": "iade", "ad": ad, "asilFatura": asil, "kalemler": [{"kalem": 1, "miktar": miktar}],
            "geri": geri or {"yol": "acik"}, "tarih": tarih}


def hesap(aid, ad, tutar, tur="vadesiz", dog=True, **kw):
    a = {"id": aid, "islem": "hesap_ac", "ad": ad, "banka": "Banka " + ad, "hesapAdi": "Hesap " + ad, "tur": tur,
         "paraBirimi": "TRY", "acilisTarihi": "01.10.2026", "acilisBakiyesi": tutar, "bakiyeDogrulandi": dog}
    a.update(kw)
    return a


TAM_NAKIT = {"pesin": [{"yol": "nakit", "tutar": "tamami"}]}


class IkiModel(unittest.TestCase):
    def ikisi(self, s):
        out = {}
        for m in ("a", "b"):
            rc, o, err = kos(m, s)
            self.assertEqual(rc, 0, "model_%s çıkış %s: %s" % (m, rc, err))
            out[m] = o
        return out["a"], out["b"]

    def ikisi_gecersiz(self, s, ipucu):
        for m in ("a", "b"):
            rc, o, err = kos(m, s)
            self.assertEqual(rc, 2, "model_%s %s beklenirken çıkış %s" % (m, ipucu, rc))
            self.assertIn(ipucu, err, "model_%s" % m)

    def acik(self, o, ad):
        return o["faturalar"][ad]["acik"]

    def belirsiz_yollar(self, o):
        return {x["alan"] for x in o.get("belirsizler") or []}


class D1IadeArtani(IkiModel):
    """§7 kural 5–7 (sürüm 2, D1 [KARAR])."""

    def test_artan_baska_acik_satis_faturasini_kapatir(self):
        """F1 120.000 peşin ödendi (açık 0); F2 60.000 açık; F1'in tamamı iade, geri ödenmedi (R1 120.000).
        Kural 5: F1 açığı 0 → artan 120.000. Kural 6: en eski açık satış faturası F2 → 60.000 kapanır; kalan 60.000 R1'in
        açığı. Cari: +120.000 − 120.000 (peşin) + 60.000 − 120.000 (iade) = −60.000 = Σaçık(alacak) 0 − Σaçık(borç) 60.000."""
        s = sen("d1-a", [
            cari("1", "M"),
            hizmet("2", "F1", "satis", "M", "1000", "01.10.2026", odeme=TAM_NAKIT),
            hizmet("3", "F2", "satis", "M", "500", "02.10.2026"),
            iade("4", "R1", "F1", "05.10.2026"),
        ])
        for o in self.ikisi(s):
            self.assertEqual(self.acik(o, "F1"), 0)
            self.assertEqual(self.acik(o, "F2"), 0)
            self.assertEqual(o["faturalar"]["R1"], {"toplam": 120000, "matrah": 100000, "kdv": 20000, "acik": 60000})
            self.assertEqual(o["cariler"]["M"], -60000)
            self.assertEqual(o["kasa"], 120000)
            self.assertNotIn("faturalar.F2.acik", self.belirsiz_yollar(o))

    def test_kapatacak_belge_yoksa_iade_acigi(self):
        """F1 peşin ödendi, başka belge yok → artan 120.000 iade belgesinin açığı (avans değil)."""
        s = sen("d1-b", [
            cari("1", "M"),
            hizmet("2", "F1", "satis", "M", "1000", "01.10.2026", odeme=TAM_NAKIT),
            iade("3", "R1", "F1", "05.10.2026"),
        ])
        for o in self.ikisi(s):
            self.assertEqual(self.acik(o, "R1"), 120000)
            self.assertEqual(o["cariler"]["M"], -120000)

    def test_en_eskiden_baslar(self):
        """F2 (02.10) 60.000 ve F3 (03.10) 120.000 açık; artan 120.000 → F2 tamamen (60.000), F3'ten 60.000 → F3 60.000.
        (Satış faturaları tarih sırasıyla girilir: BELİRSİZ-26.)"""
        s = sen("d1-c", [
            cari("1", "M"),
            hizmet("2", "F1", "satis", "M", "1000", "01.10.2026", odeme=TAM_NAKIT),
            hizmet("3", "F2", "satis", "M", "500", "02.10.2026"),
            hizmet("4", "F3", "satis", "M", "1000", "03.10.2026"),
            iade("5", "R1", "F1", "05.10.2026"),
        ])
        for o in self.ikisi(s):
            self.assertEqual(self.acik(o, "F2"), 0)
            self.assertEqual(self.acik(o, "F3"), 60000)
            self.assertEqual(self.acik(o, "R1"), 0)
            self.assertEqual(o["cariler"]["M"], 60000)

    def test_ayni_gunde_adim_sirasi(self):
        """Aynı gün (02.10) önce F2 (60.000), sonra F3 (120.000) kesildi; artan 120.000 → önce F2 (adım sırası) kapanır,
        F3'ten 60.000 → F3 açık 60.000."""
        s = sen("d1-h", [
            cari("1", "M"),
            hizmet("2", "F1", "satis", "M", "1000", "01.10.2026", odeme=TAM_NAKIT),
            hizmet("3", "F2", "satis", "M", "500", "02.10.2026"),
            hizmet("4", "F3", "satis", "M", "1000", "02.10.2026"),
            iade("5", "R1", "F1", "05.10.2026"),
        ])
        for o in self.ikisi(s):
            self.assertEqual(self.acik(o, "F2"), 0)
            self.assertEqual(self.acik(o, "F3"), 60000)
            self.assertEqual(self.acik(o, "R1"), 0)

    def test_once_asil_fatura_sonra_artan(self):
        """F1 = 2 × 500 = 1.000 + %20 = 120.000; peşin 1.000 TL → F1 açık 20.000. 1 adet iade (R1 60.000): kural 5 → F1'den
        20.000 düşer (F1 açık 0), artan 40.000 → F2 (60.000) → F2 açık 20.000; R1 açık 0. Cari 120.000 − 100.000 + 60.000
        − 60.000 = 20.000."""
        s = sen("d1-d", [
            cari("1", "M"),
            hizmet("2", "F1", "satis", "M", "500", "01.10.2026", miktar=2,
                   odeme={"pesin": [{"yol": "nakit", "tutar": "1000"}]}),
            hizmet("3", "F2", "satis", "M", "500", "02.10.2026"),
            iade("4", "R1", "F1", "05.10.2026"),
        ])
        for o in self.ikisi(s):
            self.assertEqual(self.acik(o, "F1"), 0)
            self.assertEqual(self.acik(o, "F2"), 20000)
            self.assertEqual(self.acik(o, "R1"), 0)
            self.assertEqual(o["cariler"]["M"], 20000)

    def test_geri_odenen_iade_asil_faturaya_dusulmez(self):
        """K1 (kural 2): F1 120.000 açık; 1 adet (miktar 2'nin biri, 60.000) iade nakit geri ödendi → F1 açığı 120.000 kalır,
        R1 açık 0. Cari: 120.000 − 60.000 (iade) + 60.000 (geri ödeme) = 120.000."""
        s = sen("d1-e", [
            cari("1", "M"),
            {"id": "0", "islem": "kasa_acilis", "tutar": "1000", "tarih": "01.10.2026"},
            hizmet("2", "F1", "satis", "M", "500", "01.10.2026", miktar=2),
            iade("3", "R1", "F1", "05.10.2026", geri={"yol": "nakit"}),
        ], ayarlar={"kasaEksiBakiye": "uyar"})
        for o in self.ikisi(s):
            self.assertEqual(self.acik(o, "F1"), 120000)
            self.assertEqual(self.acik(o, "R1"), 0)
            self.assertEqual(o["cariler"]["M"], 120000)
            self.assertEqual(o["kasa"], 100000 - 60000)

    def test_alistan_iade_simetrik(self):
        """Tedarikçi T: A1 120.000 peşin nakit ödendi; A2 60.000 açık; A1 iade (geri yok) 120.000 → artan A2'yi kapatır
        (60.000), R1 açık 60.000 (tedarikçi bize borçlu). Cari: −120.000 + 120.000 − 60.000 + 120.000 = +60.000."""
        s = sen("d1-f", [
            cari("1", "T", "tedarikci"),
            {"id": "0", "islem": "kasa_acilis", "tutar": "5000", "tarih": "01.10.2026"},
            hizmet("2", "A1", "alis", "T", "1000", "01.10.2026", odeme=TAM_NAKIT),
            hizmet("3", "A2", "alis", "T", "500", "02.10.2026"),
            iade("4", "R1", "A1", "05.10.2026"),
        ], ayarlar={"kasaEksiBakiye": "uyar"})
        for o in self.ikisi(s):
            self.assertEqual(self.acik(o, "A1"), 0)
            self.assertEqual(self.acik(o, "A2"), 0)
            self.assertEqual(self.acik(o, "R1"), 60000)
            self.assertEqual(o["cariler"]["T"], 60000)

    def test_taksitli_faturali_caride_belirsiz(self):
        """BELİRSİZ-7 (sürüm 2): taksitli satış faturası + artanı olan satıştan iade → o carinin açık ve kart alanları
        belirsizler'e."""
        s = sen("d1-g", [
            cari("1", "M"),
            hizmet("2", "F1", "satis", "M", "1000", "01.10.2026", odeme=TAM_NAKIT),
            hizmet("3", "FT", "satis", "M", "500", "02.10.2026", odeme={"taksit": {"ad": "K1", "sayi": 2}}),
            iade("4", "R1", "F1", "05.10.2026"),
        ])
        for o in self.ikisi(s):
            yollar = self.belirsiz_yollar(o)
            for y in ("faturalar.F1.acik", "faturalar.FT.acik", "faturalar.R1.acik", "taksitKartlari.K1.kalan"):
                self.assertIn(y, yollar)


class D4Yineleme(IkiModel):
    def test_yineleme_sinir_denetiminden_once(self):
        """Taksit kartını kapatan 120 TL tahsilat aynı kimlik ve gövdeyle yeniden gönderilir → etkisiz yineleme
        (BELİRSİZ-6 değil). Kasa 12.000, K1 ödenen 12.000, kalan 0."""
        s = sen("d4-a", [
            cari("1", "M"),
            hizmet("2", "F1", "satis", "M", "100", "01.10.2026", odeme={"taksit": {"ad": "K1", "sayi": 2}}),
            {"id": "3", "islem": "taksit_tahsilat", "kart": "K1", "tutar": "120", "yol": "nakit", "istekKimligi": "t1",
             "tarih": "05.10.2026"},
            {"id": "4", "islem": "taksit_tahsilat", "kart": "K1", "tutar": "120", "yol": "nakit", "istekKimligi": "t1",
             "tarih": "05.10.2026"},
        ])
        for o in self.ikisi(s):
            self.assertEqual(o["yinelenenler"], ["4"])
            self.assertEqual(o["kasa"], 12000)
            self.assertEqual(o["taksitKartlari"]["K1"], {"toplam": 12000, "odenen": 12000, "kalan": 0})

    def test_yinelenen_adlar_ciktida(self):
        """Taksitli fatura aynı kimlikle F2/T2 adıyla yinelenir → faturalar ve taksitKartlari'nda iki ad, aynı değer."""
        s = sen("d4-b", [
            cari("1", "M"),
            hizmet("2", "F1", "satis", "M", "500", "01.10.2026", odeme={"taksit": {"ad": "T1", "sayi": 2}},
                   istekKimligi="y1"),
            hizmet("3", "F2", "satis", "M", "500", "01.10.2026", odeme={"taksit": {"ad": "T2", "sayi": 2}},
                   istekKimligi="y1"),
        ])
        for o in self.ikisi(s):
            self.assertEqual(o["yinelenenler"], ["3"])
            self.assertEqual(o["faturalar"]["F2"], o["faturalar"]["F1"])
            self.assertEqual(o["taksitKartlari"]["T2"], {"toplam": 60000, "odenen": 0, "kalan": 60000})
            self.assertEqual(o["cariler"]["M"], 60000)


class D5D6D7Hesap(IkiModel):
    def test_yinelenen_hesap_iki_adla(self):
        """D4: hesap açılışı aynı kimlikle Z adıyla yinelenir → bankaHesaplari, hesapKodlari, eksiBakiyeDenetimi'nde iki ad."""
        s = sen("d4-c", [
            hesap("1", "ZIR", "1000", istekKimligi="h1", banka="Ziraat", hesapAdi="Ana TL Hesabı"),
            hesap("2", "ZZ", "1000", istekKimligi="h1", banka="Ziraat", hesapAdi="Ana TL Hesabı"),
        ])
        for o in self.ikisi(s):
            self.assertEqual(o["yinelenenler"], ["2"])
            self.assertEqual(o["bankaHesaplari"], {"ZIR": 100000, "ZZ": 100000})
            self.assertEqual(o["hesapKodlari"], {"ZIR": "102.01", "ZZ": "102.01"})
            self.assertEqual(o["eksiBakiyeDenetimi"], {"ZIR": "uyar", "ZZ": "uyar"})

    def test_vadeli_hesapta_banka_masrafi(self):
        """D6: vadeli hesapta BSMV dahil banka masrafı → 400 bank-account-invalid; hesap değişmez."""
        s = sen("d6-c", [
            hesap("1", "VDL", "1000", tur="vadeli"),
            {"id": "2", "islem": "banka_masraf", "hesap": "VDL", "tutar": "10,50", "masrafTuru": "EFT",
             "vergi": "bsmv_dahil"},
        ])
        for o in self.ikisi(s):
            self.assertEqual(o["retler"], [{"adim": "2", "durum": 400, "kod": "bank-account-invalid",
                                            "kodDayanak": "CIKARIM"}])
            self.assertEqual(o["bankaHesaplari"]["VDL"], 100000)

    def test_kmh_yalniz_vadesiz(self):
        """D5: ticari hesapta KMH limiti → 4xx; diğer hesapta eksi açılış → 4xx; vadesizde KMH ile −500 açılış geçer."""
        s = sen("d5-a", [
            hesap("1", "TIC", "1000", tur="ticari", kmhLimiti="1000"),
            hesap("2", "DIG", "-500", tur="diger", dog=False),
            hesap("3", "VAD", "-500", kmhLimiti="1000"),
        ])
        for o in self.ikisi(s):
            r = {x["adim"]: x for x in o["retler"]}
            self.assertEqual(r["1"]["durum"], "4xx")
            self.assertEqual(r["2"]["durum"], "4xx")
            self.assertNotIn("3", r)
            self.assertEqual(o["bankaHesaplari"], {"VAD": -50000})
            self.assertEqual(o["hesapKodlari"], {"VAD": "102.01"})

    def test_vadeli_hesapta_diger_gelir(self):
        """D6: vadeli hesapta diğer gelir → 400 bank-account-invalid; faiz geliri geçer (brüt 100, stopaj %15 → net 85)."""
        s = sen("d6-a", [
            hesap("1", "VDL", "1000", tur="vadeli"),
            {"id": "2", "islem": "diger_gelir", "hesap": "VDL", "tutar": "10"},
            {"id": "3", "islem": "faiz_geliri", "hesap": "VDL", "brut": "100", "stopajOrani": "15"},
        ])
        for o in self.ikisi(s):
            self.assertEqual(o["retler"], [{"adim": "2", "durum": 400, "kod": "bank-account-invalid",
                                            "kodDayanak": "CIKARIM"}])
            self.assertEqual(o["bankaHesaplari"]["VDL"], 100000 + 8500)

    def test_vadeli_faiz_gideri_senaryo_kurmaz(self):
        s = sen("d6-b", [
            hesap("1", "VDL", "1000", tur="vadeli"),
            {"id": "2", "islem": "faiz_gideri", "hesap": "VDL", "tutar": "10"},
        ])
        self.ikisi_gecersiz(s, "BELİRSİZ-24")

    def test_kredi_anapara_asimi_senaryo_kurmaz(self):
        """D7: kredi borcu 1.000 iken 2.000 anapara → BELİRSİZ-25."""
        s = sen("d7-a", [
            hesap("1", "ZIR", "10000"),
            hesap("2", "KR", "1000", tur="kredi", dog=False),
            {"id": "3", "islem": "kredi_odeme", "kredi": "KR", "kaynak": "ZIR", "anapara": "2000"},
        ])
        self.ikisi_gecersiz(s, "BELİRSİZ-25")


class D3Kart(IkiModel):
    def test_kartla_odeme_kart_hesabina(self):
        """D3: kurumsal kartla 100 TL cari ödemesi → B 320 / A 309.01; kart −10.000, kart ve kredi borcu 10.000;
        108.00 hareket görmez."""
        s = sen("d3-a", [
            hesap("1", "KK", "0", tur="kurumsal_kart", kartLimiti="5000"),
            cari("2", "T", "tedarikci"),
            {"id": "3", "islem": "cari_odeme", "cari": "T", "tutar": "100", "yol": "kart"},
        ])
        for o in self.ikisi(s):
            self.assertEqual(o["bankaHesaplari"]["KK"], -10000)
            self.assertEqual(o["mizan"].get("309.01"), {"borc": 0, "alacak": 10000})
            self.assertNotIn("108.00", o["mizan"])
            self.assertEqual(o["ozet"]["kartVeKrediBorcu"], 10000)
            self.assertEqual(o["cariler"]["T"], 10000)


class KasaHareketSil(IkiModel):
    def test_kasa_hareketi_silinir(self):
        """Hakem KAHIN-B: Kasa elle girişi silinebilir (§4.9 'ad: silinecekse zorunlu'). Kasa 1.000 → +100 → sil → 1.000;
        649 sıfır."""
        s = sen("kh-a", [
            {"id": "1", "islem": "kasa_acilis", "tutar": "1000"},
            {"id": "2", "islem": "kasa_hareket", "ad": "H1", "yon": "giris", "tutar": "100", "aciklama": "Hurda Satışı"},
            {"id": "3", "islem": "sil", "hedef": "H1"},
        ], ayarlar={"kasaEksiBakiye": "uyar"})
        for o in self.ikisi(s):
            self.assertEqual(o["kasa"], 100000)
            self.assertEqual(o["mizan"].get("649", {"borc": 0, "alacak": 0}), {"borc": 0, "alacak": 0})


if __name__ == "__main__":
    unittest.main()
