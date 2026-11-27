#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Bakım 25: verilen elle senaryolarda kâhinin (model.py) çıktısı ↔ elleBeklenen / elleYok (program AÇILMAZ). Kullanım: python3 -I elle-kontrol.py <model.py> [--mut N] <senaryo.json>..."""
import importlib.util
import json
import sys

args = [x for x in sys.argv[1:] if x != "--belirsiz"]
spec = importlib.util.spec_from_file_location("kahin_model_kc25", args.pop(0))
M = importlib.util.module_from_spec(spec)
spec.loader.exec_module(M)
mut = 0
if args and args[0] == "--mut":
    mut = int(args[1])
    args = args[2:]
top = kir = 0
for p in args:
    sen = json.load(open(p, encoding="utf-8"))
    try:
        m = M.Model(sen, mut, "2.5.0")
        r = m.kos()
    except Exception as e:  # noqa: BLE001
        print("%s: ÇÖKTÜ %r" % (p.split("/")[-1], e))
        kir += 1
        continue
    out = r["denetimler"]
    yanlis = [(k, b, out.get(k, {}).get("b", "ANAHTAR YOK")) for k, b in (sen.get("elleBeklenen") or {}).items() if out.get(k, {}).get("b", "ANAHTAR YOK") != b]
    yok = [k for k in (sen.get("elleYok") or []) if k in out]
    n = len(sen.get("elleBeklenen") or {}) + len(sen.get("elleYok") or [])
    top += n
    kir += len(yanlis) + len(yok)
    print("%s: %d/%d" % (p.split("/")[-1], n - len(yanlis) - len(yok), n))
    for x in yanlis[:60]:
        print("   FARK %s elle=%r kâhin=%r" % x)
    for k in yok[:30]:
        print("   YAZILMAMALIYDI %s = %r" % (k, out[k]["b"]))
    if "--belirsiz" in sys.argv:
        for b in r["belirsiz"][:40]:
            print("   belirsiz:", b[:220])
print("TOPLAM %d denetim, %d kırmızı" % (top, kir))
