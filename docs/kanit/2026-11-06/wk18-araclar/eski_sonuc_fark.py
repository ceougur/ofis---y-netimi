#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""WK 18 aracı (G3): eski senaryolar.json (değişiklikten ÖNCE alınmış kopya) ↔ yeni senaryolar.json — her eski senaryonun BÜTÜN kaydı (ad, başlık, açıklama, kaynak, serbest, girdi, elle,
modelin tam beklenen sonucu) bayt bayt (json.dumps sort_keys) karşılaştırılır; sıra ve üst alanlar da. Kullanım: python3 -I eski_sonuc_fark.py <eski.json> <yeni.json>"""
import json
import sys

eski = json.load(open(sys.argv[1], encoding="utf-8"))
yeni = json.load(open(sys.argv[2], encoding="utf-8"))


def d(o):
    return json.dumps(o, sort_keys=True, ensure_ascii=False)


es = eski["senaryolar"]; ys = yeni["senaryolar"]
yeni_ad = {s["ad"]: s for s in ys}
ayni = degisen = kayip = 0
for s in es:
    y = yeni_ad.get(s["ad"])
    if y is None:
        kayip += 1
        print(f"KAYIP {s['ad']}")
    elif d(s) == d(y):
        ayni += 1
    else:
        degisen += 1
        alanlar = [k for k in sorted(set(s) | set(y)) if d(s.get(k)) != d(y.get(k))]
        print(f"DEĞİŞEN {s['ad']}: {alanlar}")
sira = [s["ad"] for s in ys[:len(es)]] == [s["ad"] for s in es]
eklenen = [s["ad"] for s in ys if s["ad"] not in {x["ad"] for x in es}]
print(f"eski senaryo {len(es)}: AYNI {ayni}, DEĞİŞEN {degisen}, KAYIP {kayip}; sıra korunuyor: {sira}; yeni eklenen {len(eklenen)} (hepsi sonda: {[s['ad'] for s in ys[len(es):]] == eklenen})")
for a in eklenen:
    print(f"  + {a}")
for k in sorted(set(eski) | set(yeni)):
    if k == "senaryolar":
        continue
    if k == "kararlar":
        ek = sorted(set(yeni[k]) - set(eski[k]))
        degisen_k = sorted(x for x in eski[k] if d(eski[k][x]) != d(yeni[k].get(x)))
        print(f"üst alan kararlar: eklenen {ek}, değişen {degisen_k}, kaybolan {sorted(set(eski[k]) - set(yeni[k]))}")
    else:
        print(f"üst alan {k}: {'AYNI' if d(eski.get(k)) == d(yeni.get(k)) else 'DEĞİŞTİ'}")
for ad_, n_ in (("tests", len(es)), ("pass", ayni if sira else 0), ("fail", degisen + kayip + (0 if sira else len(es) - degisen - kayip)), ("cancelled", 0), ("skipped", 0), ("todo", 0)):
    print(f"# {ad_} {n_}")
sys.exit(0 if (degisen == 0 and kayip == 0 and sira) else 1)
