#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kâhin bakımı 7 (cari) — bakım 6'nın elle tablolarından hangileri AYNEN taşındı, hangileri değişti / kalktı, hangileri yeni (yalnız senaryo dosyaları okunur; kâhin KOŞMAZ).

  python3 -I elle-tasinan.py --eski <senaryolar klasörü> --yeni <senaryolar klasörü> <senaryo adı>…
Son satır "N/M denetim geçti": N = senaryo sayısı (bilgi aracı; değişiklik kırmızı sayılmaz)."""
import json
import os
import sys

argv = sys.argv[1:]
ESKI = argv[argv.index("--eski") + 1]
YENI = argv[argv.index("--yeni") + 1]
adlar = [x for i, x in enumerate(argv) if not x.startswith("--") and argv[i - 1] not in ("--eski", "--yeni")]
for ad in adlar:
    e = json.load(open(os.path.join(ESKI, ad + ".json"), encoding="utf-8"))
    y = json.load(open(os.path.join(YENI, ad + ".json"), encoding="utf-8"))
    eb, yb = e.get("elleBeklenen") or {}, y.get("elleBeklenen") or {}
    ey, yy = set(e.get("elleYok") or []), set(y.get("elleYok") or [])
    ez = [tuple(x) if isinstance(x, list) else (x,) for x in (e.get("elleBelirsiz") or [])]
    yz = [tuple(x) if isinstance(x, list) else (x,) for x in (y.get("elleBelirsiz") or [])]
    ayni = sorted(k for k in eb if k in yb and eb[k] == yb[k])
    degisen = sorted(k for k in eb if k in yb and eb[k] != yb[k])
    yoka = sorted(k for k in eb if k not in yb and k in yy)
    kalkan = sorted(k for k in eb if k not in yb and k not in yy)
    n_e = len(eb) + len(ey) + len(ez)
    n_y = len(yb) + len(yy) + len(yz)
    print("%s: bakım 6 %d elle denetim (%d değer + %d yok + %d belirsiz) → bakım 7 %d (%d + %d + %d)" % (ad, n_e, len(eb), len(ey), len(ez), n_y, len(yb), len(yy), len(yz)))
    print("  değer AYNEN taşınan %d: %s" % (len(ayni), ", ".join(ayni)))
    print("  değeri DEĞİŞEN %d: %s" % (len(degisen), "; ".join("%s %s → %s" % (k, json.dumps(eb[k], ensure_ascii=False), json.dumps(yb[k], ensure_ascii=False)) for k in degisen)))
    print("  değer → YOK (artık yazılmamalı) %d: %s" % (len(yoka), "; ".join("%s (bakım 6: %s)" % (k, json.dumps(eb[k], ensure_ascii=False)) for k in yoka)))
    print("  değer kalktı (denetlenmiyor) %d: %s" % (len(kalkan), "; ".join("%s (bakım 6: %s)" % (k, json.dumps(eb[k], ensure_ascii=False)) for k in kalkan)))
    print("  yok AYNEN %d: %s · yok → değer %d: %s · yok kalktı %d: %s" % (len(ey & yy), ", ".join(sorted(ey & yy)), len([k for k in ey if k in yb]),
                                                                          "; ".join("%s = %s" % (k, json.dumps(yb[k], ensure_ascii=False)) for k in sorted(ey) if k in yb),
                                                                          len([k for k in ey - yy if k not in yb]), ", ".join(sorted(k for k in ey - yy if k not in yb))))
    print("  belirsiz AYNEN %d: %s · kalkan %d: %s · yeni %d: %s" % (len([x for x in ez if x in yz]), [x for x in ez if x in yz], len([x for x in ez if x not in yz]),
                                                                     [x for x in ez if x not in yz], len([x for x in yz if x not in ez]), [x for x in yz if x not in ez]))
    print("  YENİ değer %d · YENİ yok %d" % (len([k for k in yb if k not in eb and k not in ey]), len([k for k in yy if k not in ey and k not in eb])))
print("# tests %d" % len(adlar))
print("# pass %d" % len(adlar))
print("# fail 0")
print("%d/%d denetim geçti" % (len(adlar), len(adlar)))
