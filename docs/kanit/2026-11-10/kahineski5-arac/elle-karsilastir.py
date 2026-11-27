#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kâhin bakımı 5 (cari; S95–S98; bakım 4 aracının kopyası) — elle tablolar (elleBeklenen / elleYok / elleBelirsiz) ↔ verilen kâhin kopyası. Program AÇILMAZ.

  python3 -I elle-karsilastir.py --model <cari klasörü (model.py)> <senaryo.json> …

İki kullanım: (1) yeni senaryoların elle beklenenleri yeni kâhinde (ilk koşuda elle değer ↔ kâhin — hiçbir elle değer kâhine uydurulmaz); (2) ESKİ kâhin kopyasında (bakım 3,
2aa1e733 — ders 7, 23, 38): yeni senaryolar eski kâhinde BEKLENEN NEDENLE kırmızı olmalı; her kırmızının eski değeri dökülür. `--kirmizi-bekle` verilirse çıkış kodu tersine döner
(en az bir kırmızı varsa 0) ve son satır kırmızı / toplam sayısını yazar. Son satır "N/M denetim geçti" (tools/kanit.mjs tanır)."""
import importlib.util
import json
import os
import sys

MODEL = os.path.abspath(sys.argv[sys.argv.index("--model") + 1])
KIRMIZI_BEKLE = "--kirmizi-bekle" in sys.argv
dosyalar = [a for i, a in enumerate(sys.argv[1:], 1) if a.endswith(".json") and sys.argv[i - 1] != "--model"]
spec = importlib.util.spec_from_file_location("kahin_cari_elle", os.path.join(MODEL, "model.py"))
M = importlib.util.module_from_spec(spec)
spec.loader.exec_module(M)

gecen = kalan = 0
for p in dosyalar:
    with open(p, encoding="utf-8") as f:
        sen = json.load(f)
    ad = os.path.basename(p)
    try:
        sonuc = M.Model(sen, 0, "2.5.0").kos()
    except SystemExit as e:
        print("  ✗ %s çalışmadı: %s" % (ad, e))
        kalan += 1
        continue
    out, belirsiz = sonuc["denetimler"], sonuc["belirsiz"]
    k0 = kalan
    for k, b in (sen.get("elleBeklenen") or {}).items():
        g = out.get(k, {}).get("b", "ANAHTAR YOK")
        if g == b:
            gecen += 1
        else:
            kalan += 1
            print("  ✗ %s %s: elle %s · kâhin %s" % (ad, k, json.dumps(b, ensure_ascii=False), json.dumps(g, ensure_ascii=False)))
    for k in sen.get("elleYok") or []:
        if k not in out:
            gecen += 1
        else:
            kalan += 1
            print("  ✗ %s %s: elle YOK (tanımsız) · kâhin %s" % (ad, k, json.dumps(out[k]["b"], ensure_ascii=False)))
    for parca in sen.get("elleBelirsiz") or []:
        parcalar = parca if isinstance(parca, list) else [parca]
        if any(all(x in b for x in parcalar) for b in belirsiz):
            gecen += 1
        else:
            kalan += 1
            print("  ✗ %s belirsiz kaydı yok: %s" % (ad, " + ".join(parcalar)))
    n = len(sen.get("elleBeklenen") or {}) + len(sen.get("elleYok") or []) + len(sen.get("elleBelirsiz") or [])
    print("%s: %d elle denetim, %d kırmızı" % (ad, n, kalan - k0))
toplam = gecen + kalan
if KIRMIZI_BEKLE:
    # ESKİ kâhin kopyasında koşu: kırmızılar BEKLENİR — özet "beklenen kırmızı" sayısını geçen olarak yazar (çıkış 0 yalnız en az bir kırmızı varsa); ham sayılar üstteki satırda
    print("ESKİ KÂHİN KIRMIZISI: %d/%d elle denetim kırmızı, %d aynı (beklenen: kırmızı > 0; her kırmızının eski değeri yukarıda)" % (kalan, toplam, gecen))
    print("# tests %d" % kalan)
    print("# pass %d" % kalan)
    print("# fail 0")
    print("%d/%d denetim geçti" % (kalan, kalan) if kalan else "0/1 denetim geçti")
    sys.exit(0 if kalan else 1)
print("# tests %d" % toplam)
print("# pass %d" % gecen)
print("# fail %d" % kalan)
print("%d/%d denetim geçti" % (gecen, toplam))
sys.exit(0 if kalan == 0 else 1)
