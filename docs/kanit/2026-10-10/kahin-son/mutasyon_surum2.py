"""Sürüm 2 testlerinin dişi: model_a / model_b'ye bilerek hata koy, test_surum2.py yakalıyor mu."""
import importlib.util
import os
import sys
import unittest

KOK = sys.argv[1]
SP = os.path.dirname(os.path.abspath(__file__)) + "/mut"
os.makedirs(SP, exist_ok=True)
src = {"a": KOK + "/test/bagimsiz/model_a/model.py", "b": KOK + "/test/bagimsiz/model_b/model.py"}
muts = {
    "a": [
        ('                for x in hedefler:\n', '                for x in []:\n'),
        ('            if 2 not in ih.gruplar() and self._yineleme_ise(i, adim, kul, islem, tarih):', '            if False:'),
        ('        if tur not in KMH_GECERLI and (kmh > 0 or S < 0):', '        if False:'),
        ('            if (bg or artan_satis_iade) and any', '            if (bg) and any'),
        ('        banka = {ad: self.bakiye(h["gl"]) for h in hesaplar for ad in adlari[h["key"]]}',
         '        banka = {ad: self.bakiye(h["gl"]) for h in hesaplar for ad in adlari[h["key"]][:1]}'),
        ('            for b in faturalar_yok', ''),
        ('        h = self.banka_hesabi_al(adim["hesap"], TUR_102 - {"vadeli"}, ih)\n        self._banka_ortak',
         '        h = self.banka_hesabi_al(adim["hesap"], TUR_102, ih)\n        self._banka_ortak'),
        ('            izinli = TUR_102 - {"vadeli"}', '            izinli = TUR_102'),
        ('        if A > -self.bakiye(kr["gl"]):', '        if False:'),
        ('                    hedefler = [x for x in db if x["tur"] == "satis" and x["kart"] is None]',
         '                    hedefler = sorted([x for x in db if x["tur"] == "satis" and x["kart"] is None], key=lambda x: -x["seq"])'),
    ],
    "b": [
        ('        for _, _, bk in hedef:\n', '        for _, _, bk in []:\n'),
        ('            if "ad" in a:\n                tanimla(aid, a["ad"], T_HAREKET, op)   # §4.9',
         '            if False:\n                tanimla(aid, a["ad"], T_HAREKET, op)   # §4.9'),
        ('        hk = c.fis_hesabi(a["hesap"], TUR_102 - {"vadeli"})     # sürüm 2 D6',
         '        hk = c.fis_hesabi(a["hesap"], TUR_102)     # sürüm 2 D6'),
        ('    if anapara > -d.bakiye(d.hesap_alt(kredi)):', '    if False:'),
        ('    if tur != "vadesiz" and ((tur in HAVALE_TURLERI and limit > 0) or (s is not None and s < 0)):',
         '    if False:'),
        ('        if (bagsiz_giris or ck in artanli_satis_iade) and any', '        if (bagsiz_giris) and any'),
        ('                           if b["cari"] == ib["cari"] and b["tur"] == "satis" and b["kart"] is None)',
         '                           if b["cari"] == ib["cari"] and b["tur"] == "satis" and b["kart"] is None)[::-1]'),
    ],
}
spec = importlib.util.spec_from_file_location("t", KOK + "/test/bagimsiz/test_surum2.py")
t = importlib.util.module_from_spec(spec)
spec.loader.exec_module(t)
sag = 0
for m, lst in muts.items():
    for i, (o, n) in enumerate(lst):
        s = open(src[m], encoding="utf-8").read()
        if not o or o not in s:
            print(m, i, "UYGULANAMADI")
            continue
        p = os.path.join(SP, "%s%d" % (m, i))
        os.makedirs(p, exist_ok=True)
        p = os.path.join(p, "model.py")
        open(p, "w", encoding="utf-8").write(s.replace(o, n, 1))
        orig = t.MODELLER[m]
        t.MODELLER[m] = p
        r = unittest.TextTestRunner(stream=open(os.devnull, "w")).run(unittest.defaultTestLoader.loadTestsFromModule(t))
        n_ = len(r.failures) + len(r.errors)
        print(m, i, "yakalandı (%d test kırmızı)" % n_ if n_ else "SAĞ KALDI")
        sag += 0 if n_ else 1
        t.MODELLER[m] = orig
print("sağ kalan:", sag)
