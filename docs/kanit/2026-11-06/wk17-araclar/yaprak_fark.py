#!/usr/bin/env python3
"""WK 17 (G3): değişen eski senaryoların 'beklenen' (TAM model sonucu) yaprak farkları — eski → yeni.
Kullanım: python3 -I yaprak_fark.py <eski senaryolar.json> <yeni senaryolar.json> <ad önekleri…>"""
import json
import sys

eski = {s["ad"]: s for s in json.load(open(sys.argv[1], encoding="utf-8"))["senaryolar"]}
yeni = {s["ad"]: s for s in json.load(open(sys.argv[2], encoding="utf-8"))["senaryolar"]}
m = lambda x: json.dumps(x, sort_keys=True, ensure_ascii=False)  # noqa: E731


def gez(a, b, yol, out):
    yaprak = lambda d: isinstance(d, dict) and ("secenek" in d or "plan_susuyor" in d)  # noqa: E731
    if isinstance(a, dict) and isinstance(b, dict) and not yaprak(a) and not yaprak(b):
        for k in sorted(set(a) | set(b)):
            gez(a.get(k, "<YOK>"), b.get(k, "<YOK>"), f"{yol}.{k}", out)
        return
    if isinstance(a, list) and isinstance(b, list) and len(a) == len(b):
        for i, (x, y) in enumerate(zip(a, b)):
            gez(x, y, f"{yol}[{i}]", out)
        return
    if m(a) != m(b):
        kisa = lambda v: (m({"secenek": v["secenek"]}) if isinstance(v, dict) and "secenek" in v else m(v))[:150]  # noqa: E731
        out.append(f"  {yol}: {kisa(a)} → {kisa(b)}")


for on in sys.argv[3:]:
    for ad in [a for a in eski if a.startswith(on)]:
        out = []
        gez(eski[ad]["beklenen"], yeni[ad]["beklenen"], "beklenen", out)
        secenekten = sum(1 for x in out if '{"secenek"' in x.split(" → ")[0] and '{"secenek"' not in x.split(" → ")[1])
        print(f"{ad}: {len(out)} yaprak değişti ({secenekten}'i secenek → kesin)")
        for x in out:
            print(x)
