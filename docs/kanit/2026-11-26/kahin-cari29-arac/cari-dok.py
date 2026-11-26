#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Cari kâhini bakımı 29: bir rastgele senaryonun (ya da senaryo dosyasının) bir carisinin adımlarını tarih sırasıyla döker + kâhinin o cariye yazdığı denetimler (program AÇILMAZ).
  python3 -I cari-dok.py --model <cari klasörü> (--tohum N [--tur s1] [--islem 120] | --dosya <senaryo.json>) --cari D [--anahtar <alt dizgi>]"""
import importlib.util
import json
import os
import subprocess
import sys


def arg(ad, v=None):
    return sys.argv[sys.argv.index(ad) + 1] if ad in sys.argv else v


MODEL = os.path.abspath(arg("--model"))
spec = importlib.util.spec_from_file_location("kahin_cari_dok", os.path.join(MODEL, "model.py"))
M = importlib.util.module_from_spec(spec)
spec.loader.exec_module(M)
if arg("--dosya"):
    sen = json.load(open(arg("--dosya"), encoding="utf-8"))
else:
    sen = json.loads(subprocess.run([sys.executable, "-I", os.path.join(MODEL, "uretici.py"), "--tur", arg("--tur", "s1"), "--tohum", arg("--tohum"), "--islem", arg("--islem", "120")],
                                    capture_output=True, text=True, check=True).stdout)
C = arg("--cari")
print("bugün", sen.get("bugun"))
for i, a in enumerate(sen["adimlar"]):
    if a.get("cari") == C or (a["islem"] == "cari_ac" and a.get("ad") == C) or a["islem"] in ("kontrol",):
        print(i, json.dumps(a, ensure_ascii=False))
m = M.Model(sen, 0, "2.5.0")
out = m.kos()
den = out["denetimler"] if isinstance(out, dict) and "denetimler" in out else m.out
an = arg("--anahtar")
for k_, v in sorted(den.items()):
    if (":%s:" % C) in k_ or (an and an in k_):
        print(k_, json.dumps(v.get("b") if isinstance(v, dict) else v, ensure_ascii=False))
for b in m.belirsiz:
    if (" %s " % C) in b:
        print("BELİRSİZ", b[:300])
