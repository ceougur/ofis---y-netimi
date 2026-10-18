#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""e-Belge kâhin modeli — MUTASYON testi (testin dişi, CLAUDE.md KANIT KURALI 3 / ders 7).

  python3 test/bagimsiz/ebelge/mutasyon.py

Modele bilerek kural hatası enjekte eder (her mutant bir kuralı bozar) ve test_model.py'yi o mutanta karşı koşar. Her mutantı en az bir
test yakalamalı ("öldürülmeli"); sağ kalan mutant = eksik test. Ayrıca bozulmamış model önce koşulur (yeşil olmalı).
Çıkış: 0 bütün mutantlar öldü ve temel yeşil · 1 aksi.
"""

import contextlib
import io
import os
import sys
import unittest

BURASI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BURASI)
import model as M  # noqa: E402
import test_model  # noqa: E402

D = M.Dunya


def _tutan_engelliler_de(self, b):
    # O1 hatasının modeldeki karşılığı: kalıcı engelli eski bekleyen de seriyi bekletir.
    seri, yil = self.seri_yil(b)
    for x in self.belgeler.values():
        if x is b or x.get("var") is not True or x["tur"] != b["tur"] or self.seri_yil(x) != (seri, yil):
            continue
        if x["numara"] == "" and not x["iptal"] and not x["silindi"] and x["prog"] is False and x["tarih"] < b["tarih"]:
            return x["ad"]
    return None


def _engel_pk_yok_degil(self, b):
    if b["tur"] == "kagit":
        return "kagit"
    c = self.cariler[b["cari"]]
    if b["tur"] == "earsiv" and c["mukellef"]:
        return "alici-efatura"
    return None


def _engel_alici_efatura_degil(self, b):
    if b["tur"] == "kagit":
        return "kagit"
    c = self.cariler[b["cari"]]
    if b["tur"] == "efatura" and not c["pk"]:
        return "pk-yok"
    return None


def _sira_yeniden_eskiye(self, adlar=None):
    xs = ORJ["sira_listesi"](self, adlar)
    return sorted(xs, key=lambda b: (b["tarih"], b["sira"]), reverse=True)


def _son_bosluklu(self, seri, yil):
    s, t = ORJ["son"](self, seri, yil)
    return (s + 1 if s else s, t)  # bir numara atlar


def _seri_yil_yilsiz(self, b):
    return M.SERI[b["tur"]], 2026


def _bekleyen_silineni_de(self, b):
    if b.get("var") is not True or b["tur"] == "kagit" or b["iptal"]:
        return False
    return not b["prog"]


ORJ = {"tutan": D.tutan, "engel": D.engel, "sira_listesi": D.sira_listesi, "son": D.son, "tarih_engeli": D.tarih_engeli,
       "seri_yil": D.seri_yil, "bekleyen": D.bekleyen, "uygula": M.uygula, "gonder": M.gonder, "numara": M.numara}


def _uygula_sarmali(degistir):
    def f(d, adim):
        return degistir(d, adim) or ORJ["uygula"](d, adim)
    return f


def _iptal_yok(d, adim):
    if adim["islem"] == "iptal":
        return [d]
    return None


def _sil_yok(d, adim):
    if adim["islem"] == "listeden_sil":
        return [d]
    return None


def _gonderilmis_duzenlenir(d, adim):
    if adim["islem"] == "duzenle_tarih":
        b = d.belgeler.get(adim["belge"])
        if b and b.get("var") is True and (b["prog"] or b["edm"]):
            b["tarih"] = adim["tarih"]
            d.yanit = "2xx"
            return [d]
    return None


def _ileri_tarih_kabul(d, adim):
    if adim["islem"] == "kaydet" and adim["tarih"] > d.bugun:
        d2 = d.kopya()
        d2.bugun = adim["tarih"]
        r = ORJ["uygula"](d2, adim)
        for w in r:
            w.bugun = d.bugun
        return r
    return None


def _durum_sorgula_yok(d, adim):
    if adim["islem"] == "durum_sorgula":
        return [d]
    return None


def _tur_secileni_unutur(d, adim):
    if adim["islem"] == "tumunu_gonder" and adim.get("kapsam") == "secili":
        return M.tur_gonder(d, None)
    return None


def _gonder_ag_yok_saymaz(d, ad):
    ag = d.ag
    d.ag = True
    r = ORJ["gonder"](d, ad)
    for w, _ in r:
        w.ag = ag
    return r


def _gonder_kopmada_hep_birakir(d, ad):
    r = ORJ["gonder"](d, ad)
    for w, s in r:
        b = w.belgeler[ad]
        if s == "hata" and not b.get("hata_gecici"):
            b["numara"] = ""
    return r


def _gonder_engelliyi_de_yollar(d, ad):
    b = d.belgeler[ad]
    if d.engel(b) in ("pk-yok", "alici-efatura") and d.ag and not b["iptal"] and not b["prog"]:
        seri, yil = d.seri_yil(b)
        b["numara"] = b["numara"] or M.numara(seri, yil, d.son(seri, yil)[0] + 1)
        b["edm"] = b["prog"] = True
        return [(d, "gitti")]
    return ORJ["gonder"](d, ad)


def _gonder_zaten_gonderilmisi_yeniden(d, ad):
    b = d.belgeler[ad]
    if b["edm"] and not b["prog"] and d.ag:
        seri, yil = d.seri_yil(b)
        b["numara"] = M.numara(seri, yil, d.son(seri, yil)[0] + 1)  # yeni numarayla yeniden gönderir
        b["prog"] = True
        return [(d, "gitti")]
    return ORJ["gonder"](d, ad)


MUTANTLAR = [
    ("M1 bekletme yok (K8)", lambda: setattr(D, "tutan", lambda self, b: None)),
    ("M2 kalıcı engelli de bekletir (O1 benzeri, K9)", lambda: setattr(D, "tutan", _tutan_engelliler_de)),
    ("M3 PK'sız e-Fatura engel sayılmaz (K2)", lambda: setattr(D, "engel", _engel_pk_yok_degil)),
    ("M4 mükellefe e-Arşiv engel sayılmaz (K3)", lambda: setattr(D, "engel", _engel_alici_efatura_degil)),
    ("M5 tarih engeli yok (K6)", lambda: setattr(D, "tarih_engeli", lambda self, b: False)),
    ("M6 tur yeniden eskiye (K10)", lambda: setattr(D, "sira_listesi", _sira_yeniden_eskiye)),
    ("M7 seri boşluklu (K5)", lambda: setattr(D, "son", _son_bosluklu)),
    ("M8 yıl ayrımı yok (K5)", lambda: setattr(D, "seri_yil", _seri_yil_yilsiz)),
    ("M9 silinen de bekleyen sayılır (K7)", lambda: setattr(D, "bekleyen", _bekleyen_silineni_de)),
    ("M10 iptal işlenmez (K24)", lambda: setattr(M, "uygula", _uygula_sarmali(_iptal_yok))),
    ("M11 Listeden Sil işlenmez (K7)", lambda: setattr(M, "uygula", _uygula_sarmali(_sil_yok))),
    ("M12 gönderilmiş belge düzenlenir (K25)", lambda: setattr(M, "uygula", _uygula_sarmali(_gonderilmis_duzenlenir))),
    ("M13 ileri tarih kabul (K16)", lambda: setattr(M, "uygula", _uygula_sarmali(_ileri_tarih_kabul))),
    ("M14 Durum Sorgula işlemez (K28)", lambda: setattr(M, "uygula", _uygula_sarmali(_durum_sorgula_yok))),
    ("M15 seçili tur hepsini gönderir (K10)", lambda: setattr(M, "uygula", _uygula_sarmali(_tur_secileni_unutur))),
    ("M16 ağ yokken de numara/gönderim (K12)", lambda: setattr(M, "gonder", _gonder_ag_yok_saymaz)),
    ("M17 kopmada numara bırakılır (K14)", lambda: setattr(M, "gonder", _gonder_kopmada_hep_birakir)),
    ("M18 engelli belge de gönderilir (K2/K3)", lambda: setattr(M, "gonder", _gonder_engelliyi_de_yollar)),
    ("M19 'zaten gönderildi' yeni numarayla yeniden gönderilir (K11)", lambda: setattr(M, "gonder", _gonder_zaten_gonderilmisi_yeniden)),
    ("M20 numara biçimi 8 hane sıra (K5)", lambda: setattr(M, "numara", lambda s, y, n: f"{s}{y:04d}{n:08d}")),
]


def geri_al():
    D.tutan, D.engel, D.sira_listesi, D.son = ORJ["tutan"], ORJ["engel"], ORJ["sira_listesi"], ORJ["son"]
    D.tarih_engeli, D.seri_yil, D.bekleyen = ORJ["tarih_engeli"], ORJ["seri_yil"], ORJ["bekleyen"]
    M.uygula, M.gonder, M.numara = ORJ["uygula"], ORJ["gonder"], ORJ["numara"]


def kos():
    suite = unittest.defaultTestLoader.loadTestsFromModule(test_model)
    with contextlib.redirect_stderr(io.StringIO()), contextlib.redirect_stdout(io.StringIO()):
        r = unittest.TextTestRunner(stream=io.StringIO(), verbosity=0).run(suite)
    adlar = [t.id().split(".")[-1] for t, _ in r.failures + r.errors]
    return r.testsRun, adlar


def main():
    n, kirmizi = kos()
    print(f"temel (bozulmamış model): {n} test, {len(kirmizi)} kırmızı")
    if kirmizi:
        print("  TEMEL KIRMIZI:", kirmizi)
        return 1
    sag = []
    for ad, uygula in MUTANTLAR:
        uygula()
        try:
            n, kirmizi = kos()
        finally:
            geri_al()
        durum = "ÖLDÜ" if kirmizi else "SAĞ KALDI"
        print(f"{ad:<62} {durum:<10} ({len(kirmizi)}/{n} test kırmızı: {', '.join(kirmizi[:3])}{' …' if len(kirmizi) > 3 else ''})")
        if not kirmizi:
            sag.append(ad)
    print(f"# tests {len(MUTANTLAR)}")
    print(f"# pass {len(MUTANTLAR) - len(sag)}")
    print(f"# fail {len(sag)}")
    return 1 if sag else 0


if __name__ == "__main__":
    sys.exit(main())
