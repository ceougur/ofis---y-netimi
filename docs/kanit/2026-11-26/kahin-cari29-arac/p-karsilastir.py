#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Cari kâhini bakımı 28: d60'ın program ↔ kâhin değerlerini cari cari (k0 / k1) yan yana döker — P listesinin en küçük örnekleri için (yalnız okuma; program AÇILMAZ, kos.mjs çıktı klasörünü okur).
  python3 -I p-karsilastir.py <kos.mjs --cikti klasörü>"""
import json
import os
import sys

K = sys.argv[1]
ad = "d60-c5-s255-s254-bagli-odeme-kartli-fatura"
p = json.load(open(os.path.join(K, ad + ".program.json"), encoding="utf-8"))
k = json.load(open(os.path.join(K, ad + ".kahin.json"), encoding="utf-8"))["denetimler"]


def deger(d, x):
    v = d.get(x)
    return v.get("b") if isinstance(v, dict) and "b" in v else v


for c in ["V1", "V2", "V3", "V4", "V5", "V6", "V7", "V8", "V9", "V10", "V11", "V12", "Q1", "Q2"]:
    for kk in ("k0", "k1"):
        ks = sorted(x for x in set(k) | set(p) if x.startswith(kk + ":") and x in k and any(s in x for s in (":%s:" % c, ":F%s:" % c, ":K%s:" % c, ":K1%s:" % c, ":K2%s:" % c, ":I%s:" % c))
                    and "liste:" not in x)
        satir = []
        for x in ks:
            a, b = deger(k, x), deger(p, x)
            satir.append("%s=%s%s" % (x.split(":", 1)[1], json.dumps(a, ensure_ascii=False), "" if a == b else " [program %s]" % json.dumps(b, ensure_ascii=False)))
        print("%s %s: %s" % (c, kk, " · ".join(satir)))
