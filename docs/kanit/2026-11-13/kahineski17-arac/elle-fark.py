#!/usr/bin/env python3
"""Bakım 17 (bakım 16 aracının uyarlaması; izin listesi bakım 17 kararlarına göre): eski kopyanın (bakım 16) elle tabloları ↔ yeni kopyanın elle tabloları — DEĞİŞEN her eski beklenti tek tek (elleBeklenen değer / elleYok / elleBelirsiz).
Program AÇILMAZ; yalnız senaryo dosyaları okunur. İzinli değişiklikler yalnız bakım 17 kararları gereği: d44 X12 (S159 A — SK-35 kalktı) ve Y4 (S162 = B), d42 T7 (S162 = B) ve T6 (SK-37), d43 U1 / U2
(S154 B — 'Tahsil Edilen' değer; S144 kaydı kalktı). Adımlar aynı olmalı — İSTİSNA (§28 Y17-4): d43 u1k / u2k ve d30 q1k / q3k / q5k adımlarına yalnız `fazlasiniAvansYaz: true` eklendi
(o alan çıkarılınca adımlar bayt bayt aynı olmalı); açıklama metni (`aciklama`) karşılaştırılmaz.
  python3 -I elle-fark.py --eski <eski test/bagimsiz/cari> --yeni <yeni test/bagimsiz/cari>
Son satır "N/M denetim geçti" (tools/kanit.mjs tanır)."""
import json
import os
import sys

ESKI = os.path.join(os.path.abspath(sys.argv[sys.argv.index("--eski") + 1]), "senaryolar")
YENI = os.path.join(os.path.abspath(sys.argv[sys.argv.index("--yeni") + 1]), "senaryolar")
IZINLI = {"d44-c5-s155-s158.json": ("x12t:durum", ":X12:", "adım x12t", "KY4:taksit", "KY4:toplam", ":Y4:gecikmis", "kart KY4"),
          "d42-c5-s140-s151-satis-karti-iade.json": ("KT7:toplam", "KT7:taksit", ":T7:gecikmis", "kart KT7", "KT6:taksit", "KT6:toplam", ":T6:gecikmis", "kart KT6"),
          "d43-c5-bilinen-sinir-sus15.json": ("KU1:odenen", "KU2:odenen", "kart KU1", "kart KU2")}
SECENEK = {"d43-c5-bilinen-sinir-sus15.json": {"u1k", "u2k"}, "d30-c5-s101-bitti-kart.json": {"q1k", "q3k", "q5k"}}


def secenegi_cikar(f, adimlar):
    out = []
    for a in adimlar:
        if a.get("id") in SECENEK.get(f, ()) and a.get("fazlasiniAvansYaz") is True:
            a = {k: v for k, v in a.items() if k != "fazlasiniAvansYaz"}
        out.append(a)
    return out
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
    adim_ayni = e["adimlar"] == secenegi_cikar(f, y["adimlar"])
    if e["adimlar"] != y["adimlar"]:
        n_ = sum(1 for a, b in zip(e["adimlar"], y["adimlar"]) if a != b)
        print("%s: %d adıma yalnız `fazlasiniAvansYaz: true` eklendi (§28 Y17-4)%s" % (f, n_, "" if adim_ayni else " — BAŞKA FARK VAR"))
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
