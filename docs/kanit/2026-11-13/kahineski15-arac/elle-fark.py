#!/usr/bin/env python3
"""Bakım 15 (bakım 14 aracının uyarlaması): eski kopyanın (bakım 14) elle tabloları ↔ yeni kopyanın elle tabloları — DEĞİŞEN her eski beklenti tek tek (elleBeklenen değer / elleYok / elleBelirsiz).
Program AÇILMAZ; yalnız senaryo dosyaları okunur. İzinli değişiklikler yalnız bakım 15 kararları gereği: d39 (S139 gecikmiş; S145 N11), d40 (S136 Q3 / Q4; S137 / S138 Q1 / Q1b / Q2 metni),
d12 F2 (S149 = C), d30 KQ1 / KQ3 (S144 = C), d34 KE10 (S143 = C); adımlar aynı olmalı.
  python3 -I elle-fark.py --eski <eski test/bagimsiz/cari> --yeni <yeni test/bagimsiz/cari>
Son satır "N/M denetim geçti" (tools/kanit.mjs tanır)."""
import json
import os
import sys

ESKI = os.path.join(os.path.abspath(sys.argv[sys.argv.index("--eski") + 1]), "senaryolar")
YENI = os.path.join(os.path.abspath(sys.argv[sys.argv.index("--yeni") + 1]), "senaryolar")
IZINLI = {"d39-c5-s130-supheli-kalemleri.json": (":gecikmis", "N11:bakiye", "n11x:kalan", "adim:n11t:durum"),
          "d40-c5-s130-sus-bilinen-sinir.json": ("Q3:gecikmis", "q4x", "q4o", ":Q4", "cari Q1 S130", "cari Q1b S130", "cari Q2 S130", "cari Q3 S130", "cari Q4 S130"),
          "d12-c5-s69-soz-gunu-ve-gecmis.json": ("f2", "F2"),
          "d30-c5-s101-bitti-kart.json": ("KQ1:odenen", "KQ3:odenen", "kart KQ1", "kart KQ3"),
          "d34-c5-s110-kendi-borcu.json": ("KE10:kalan", "kart KE10")}
gecen = kalan = 0


def yukle(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


for f in sorted(os.listdir(ESKI)):
    if not f.endswith(".json"):
        continue
    e, y = yukle(os.path.join(ESKI, f)), yukle(os.path.join(YENI, f))
    satir = []
    eb, yb = e.get("elleBeklenen") or {}, y.get("elleBeklenen") or {}
    for k in sorted(set(eb) | set(yb)):
        if eb.get(k, "∅") != yb.get(k, "∅"):
            satir.append(("değer", k, eb.get(k, "(yok)"), yb.get(k, "(yok)")))
    ey, yy = set(e.get("elleYok") or []), set(y.get("elleYok") or [])
    satir += [("elleYok kalktı", k, "yok", "") for k in sorted(ey - yy)] + [("elleYok eklendi", k, "", "yok") for k in sorted(yy - ey)]
    eB, yB = [json.dumps(x, ensure_ascii=False) for x in e.get("elleBelirsiz") or []], [json.dumps(x, ensure_ascii=False) for x in y.get("elleBelirsiz") or []]
    satir += [("elleBelirsiz kalktı", x, "", "") for x in eB if x not in yB] + [("elleBelirsiz eklendi", x, "", "") for x in yB if x not in eB]
    adim_ayni = e["adimlar"] == y["adimlar"]
    izin = IZINLI.get(f)
    disari = [s for s in satir if not (izin and any(p in s[1] for p in izin))]
    ok = adim_ayni and not disari
    gecen += ok
    kalan += not ok
    if satir or not adim_ayni:
        print("%s: %d elle beklenti değişti%s%s" % (f, len(satir), "" if adim_ayni else " · ADIMLAR DEĞİŞTİ", " · İZİNSİZ %d" % len(disari) if disari else ""))
        for tur, k, a, b in satir:
            print("    %-22s %s: %s → %s" % (tur, k, json.dumps(a, ensure_ascii=False), json.dumps(b, ensure_ascii=False)))
yeni_dosya = sorted(set(x for x in os.listdir(YENI) if x.endswith(".json")) - set(os.listdir(ESKI)))
print("yeni elle senaryo: %s" % (", ".join(yeni_dosya) or "yok"))
print("# tests %d" % (gecen + kalan))
print("# pass %d" % gecen)
print("# fail %d" % kalan)
print("%d/%d denetim geçti" % (gecen, gecen + kalan))
sys.exit(0 if kalan == 0 else 1)
