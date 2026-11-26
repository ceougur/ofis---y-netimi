#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Cari kâhini bakımı 29 (§41): S266 / S265 alanının rastgele senaryolardaki yeri — program AÇILMAZ, yalnız kâhin modeli (verilen kopya) koşar.

  python3 -I alan-tara.py --model <test/bagimsiz/cari> [--tohum 1-30] [--islem 120] [--tur s1]

Her cari için: yalın değilse nedeni; bağsız Ödeme (borç yönlü 'o' kaynak) var mı; alacak tarafının son durumda ARTAN bağsız alacak kaynağı (alınan avans — tahsilat / alınan evrak /
bağ fazlası; faturasız iade ve değersiz HARİÇ) var mı; borç tarafında alacak yönlü kalem (alış / Alacak / alacaklı Açılış) ve verilen avans (borç tarafının artan 'o' kaynağı) var mı.
Yalnız tarama — sonuç kural değildir."""
import importlib.util
import json
import os
import subprocess
import sys


def arg(ad, v=None):
    return sys.argv[sys.argv.index(ad) + 1] if ad in sys.argv else v


MODEL = os.path.abspath(arg("--model"))
a, b = (arg("--tohum", "1-30").split("-") + [None])[:2]
TOHUMLAR = range(int(a), int(b or a) + 1)
ISLEM = arg("--islem", "120")
TUR = arg("--tur", "s1")
spec = importlib.util.spec_from_file_location("kahin_cari_tara", os.path.join(MODEL, "model.py"))
M = importlib.util.module_from_spec(spec)
spec.loader.exec_module(M)

for t in TOHUMLAR:
    sen = json.loads(subprocess.run([sys.executable, "-I", os.path.join(MODEL, "uretici.py"), "--tur", TUR, "--tohum", str(t), "--islem", ISLEM],
                                    capture_output=True, text=True, check=True).stdout)
    m = M.Model(sen, 0, "2.5.0")
    m.kos()
    for c, cv in m.cariler.items():
        if cv.get("silindi"):
            continue
        yalin, neden = m._net_uygun(c)
        o_bagsiz = [o for o in m.odemeler.values() if o["aktif"] and o["cari"] == c and not o["fatura"]]
        if yalin or not o_bagsiz:
            continue
        t250 = m.tyk250(c)
        alinan = {q: x for q, x in t250["kaynak_kalan"].items() if x > 0 and not q.startswith("kap:")}
        m.kuyruk_borc(c)
        verilen = [(d, x, ad) for d, x, h, ad in m._onbellek[("b250", c)] if h == "o" and x > 0]
        alacak_k = [hn for hn, h in m.hareketler.items() if h["cari"] == c and h["aktif"] and (h["tur"] == "alacak" or (h["tur"] == "acilis" and h["yon"] == "alacak"))]
        alacak_k += [ad for ad, f in m.faturalar.items() if f["cari"] == c and f["durum"] == "kesildi" and f["tur"] == "alis"]
        nd = m.net_durum(c)[0]
        print("tohum %d cari %s · %s · bagsiz odeme %d · alinan avans %s · verilen avans %s · alacak yonlu kalem %s · net_durum %s · t250 neden %s" % (
            t, c, neden, len(o_bagsiz), alinan or "-", verilen or "-", alacak_k or "-", nd, "VAR" if t250["neden"] else "-"))
