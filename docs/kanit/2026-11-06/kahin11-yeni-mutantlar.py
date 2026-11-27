"""Bakım 11 — yeni / metni değişen mutantların ÖLDÜREN testleri (yalnız ilgili testler koşulur; tam liste mutasyon.py'de).

Kullanım: python3 -I kahin11-yeni-mutantlar.py <test/bagimsiz/muhasebe klasörü>
Her mutant için: mutantlı model yüklenir, seçili elle senaryolar (s104–s109) ve birim testleri koşulur; kırmızı testler ve ilk iletileri yazılır.
Elle senaryoda kırmızı = DEĞERLE yakalandı (elle anahtar ya da red listesi farklı); "susma" iletisi ayrıca işaretlenir.
"""
import contextlib
import io
import os
import sys
import unittest

KLASOR = sys.argv[1]
sys.path.insert(0, KLASOR)
import mutasyon as MU  # noqa: E402

ONEKLER = ("B78 ", "B97 ", "B105", "B106", "B107", "B108", "B109")
ELLE = ("s104", "s105", "s106", "s107", "s108", "s109")
BIRIM = ("test_S40_S44_S45_kapsam_ve_susma", "test_S79_olagan_kayit_bag_cari", "test_S80_formdaki_pesin_cari", "test_S81_olagan_duzeltme_siniri",
         "test_S81_S56_ile_ayni", "test_S83_S84_formdaki_pesin", "test_S85_tutar_tarih_siniri", "test_S85_iki_yolda_ayni")
src = open(os.path.join(KLASOR, "model.py"), encoding="utf-8").read()


def kos(kaynak):
    tm = MU.yukle(kaynak)
    yk = unittest.defaultTestLoader
    suite = unittest.TestSuite()
    for ad in yk.getTestCaseNames(tm.ElleSenaryolar):
        if ad[5:9] in ELLE:
            suite.addTest(tm.ElleSenaryolar(ad))
    for ad in BIRIM:
        suite.addTest(tm.OlayMaddeleri(ad))
    with contextlib.redirect_stderr(io.StringIO()), contextlib.redirect_stdout(io.StringIO()):
        r = unittest.TextTestRunner(stream=io.StringIO(), verbosity=0).run(suite)
    return r.testsRun, [(t.id().split(".")[-1], (m.strip().splitlines() or [""])[-1][:150]) for t, m in r.failures + r.errors]


n, kirmizi = kos(src)
print(f"temel: {n} test, {len(kirmizi)} kırmızı {kirmizi}")
sag = 0
for ad, deg in MU.MUTANTLAR:
    if not ad.startswith(ONEKLER):
        continue
    n, kirmizi = kos(MU.mutant_kaynak(src, deg))
    print(f"\n{ad}\n  {'ÖLDÜ' if kirmizi else 'SAĞ KALDI'} ({len(kirmizi)}/{n})")
    sag += not kirmizi
    for t, m in kirmizi:
        tur = "elle (değer)" if t.startswith("test_s1") else "birim"
        if "senaryo hatası" in m or "mutant:" in m:
            tur += " — susma"
        print(f"   {t} [{tur}]: {m}")
MU.yukle(src)
print(f"\n# sağ kalan {sag}")
