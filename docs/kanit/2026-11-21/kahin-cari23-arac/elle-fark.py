#!/usr/bin/env python3
"""Toplu kâhin bakımı 14 / cari bakım 22 (bakım 21b aracının uyarlaması; izin listesi bakım 22 kararlarına göre — d50 I2 / KI2 / I3 / KI3). Eski not: Bakım 21b: eski kopyanın (bakım 21) elle tabloları ↔ yeni kopyanın elle tabloları — DEĞİŞEN her eski beklenti tek tek
(elleBeklenen değer / elleYok / elleBelirsiz). Program AÇILMAZ; yalnız senaryo dosyaları okunur. Bakım 21b'de izinli değişiklik YALNIZ d49 A1 / KA1 (S206 = A — C13.4 (11) susması kalktı, kapanmış kartın
göstergeleri SUS); adımı değişen senaryo YOK; açıklama metni (`aciklama`) karşılaştırılmaz.
  python3 -I elle-fark.py --eski <eski test/bagimsiz/cari> --yeni <yeni test/bagimsiz/cari>
Son satır "N/M denetim geçti" (tools/kanit.mjs tanır)."""
import json
import os
import sys

ESKI = os.path.join(os.path.abspath(sys.argv[sys.argv.index("--eski") + 1]), "senaryolar")
YENI = os.path.join(os.path.abspath(sys.argv[sys.argv.index("--yeni") + 1]), "senaryolar")
# bakım 23 (§35 Y23-5): S200 = A — d35 H8 değerle (SK-20 kalktı), d36 J14 SK-20 → SK-23 (elleBelirsiz)
IZINLI = {"d35-c5-s120-elle-borclar.json": (":H8:", ":KH8:", ":h8x:", ":H8F:", "H8 "), "d36-c5-s122-kart-odemesi.json": ("J14 ",)}
ADIM_IZIN = set()  # bakım 21b: adımı değişen senaryo yok
SECENEK = {}


def d45_eski_adimlar(adimlar):
    """Yeni d45'in adımlarından eski hâli: B3 … B6 adımları çıkar, b2y eski yerine (b2i'den sonra) ve eski tarihine (12.06) döner."""
    yeni_c = {"B3", "B4", "B5", "B6"}
    out = [a for a in adimlar if not (a.get("cari") in yeni_c or (a.get("islem") == "cari_ac" and a.get("ad") in yeni_c) or a.get("id") == "b6s")]
    b2y = next(a for a in out if a.get("id") == "b2y")
    out.remove(b2y)
    b2y = dict(b2y, tarih="2026-06-12")
    out.insert(next(i for i, a in enumerate(out) if a.get("id") == "b2i") + 1, b2y)
    return out


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
    adim_ayni = e["adimlar"] == (d45_eski_adimlar(y["adimlar"]) if f in ADIM_IZIN else secenegi_cikar(f, y["adimlar"]))
    if e["adimlar"] != y["adimlar"]:
        n_ = sum(1 for a, b in zip(e["adimlar"], y["adimlar"]) if a != b)
        print("%s: %d adım değişti%s" % (f, n_, "" if adim_ayni else " — BAŞKA FARK VAR"))
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
