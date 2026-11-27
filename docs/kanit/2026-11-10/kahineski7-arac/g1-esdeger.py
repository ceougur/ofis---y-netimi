#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kâhin bakımı 7 (cari) — G1 koşulu: yeri değişen senaryoda kâhinin BÜTÜN çıktısı (denetimler değer + etiket + kural metni, `belirsiz`, ad, dil, kural) önce / sonra bayt bayt aynı mı.
Program AÇILMAZ.

  python3 -I g1-esdeger.py --model <cari klasörü> [--model <cari klasörü> …] --eski <senaryolar klasörü> --yeni <senaryolar klasörü> [--dokum <json>] <senaryo adı>…

Her model × her senaryo × beş kip (2.5.0, 2.4.9, 2.4.6, 2.4.5, --legacy): json.dumps(kos(), sort_keys) eski dosyada ve yeni dosyada aynı olmalı; ayrıca adımların çoklu kümesi aynı (yalnız yer
değişti) ve her carinin adım dizisi aynı. --dokum: her (model, senaryo, kip) için iki çıktının sha256'sı, denetim sayısı, belirsiz sayısı. Son satır "N/M denetim geçti"."""
import hashlib
import importlib.util
import json
import os
import sys

argv = sys.argv[1:]
modeller = [os.path.abspath(argv[i + 1]) for i, x in enumerate(argv) if x == "--model"]
ESKI = os.path.abspath(argv[argv.index("--eski") + 1])
YENI = os.path.abspath(argv[argv.index("--yeni") + 1])
DOKUM = argv[argv.index("--dokum") + 1] if "--dokum" in argv else None
atla = {i + 1 for i, x in enumerate(argv) if x in ("--model", "--eski", "--yeni", "--dokum")}
adlar = [x for i, x in enumerate(argv) if i not in atla and not x.startswith("--")]
KIPLER = ("2.5.0", "2.4.9", "2.4.6", "2.4.5", "2.4.4")

gecen = kalan = 0
dokum = []


def denetle(ad, ok, ayrinti=""):
    global gecen, kalan
    if ok:
        gecen += 1
    else:
        kalan += 1
        print("  ✗ %s %s" % (ad, ayrinti))


def yukle(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def cari_dizisi(sen):
    fc = {a["ad"]: a["cari"] for a in sen["adimlar"] if a["islem"] == "fatura"}
    kc = {a["ad"]: a["cari"] for a in sen["adimlar"] if a["islem"] in ("kart_ac", "stok_satis_taksit")}
    d = {}
    for a in sen["adimlar"]:
        c = a.get("cari") or (a["ad"] if a["islem"] == "cari_ac" else None) or fc.get(a.get("fatura")) or kc.get(a.get("kayit")) or "<genel>"
        d.setdefault(c, []).append(a["id"])
    return d


for ad in adlar:
    e, y = yukle(os.path.join(ESKI, ad + ".json")), yukle(os.path.join(YENI, ad + ".json"))
    denetle("%s adım kümesi aynı (yalnız yer değişti)" % ad,
            sorted(json.dumps(a, sort_keys=True, ensure_ascii=False) for a in e["adimlar"]) == sorted(json.dumps(a, sort_keys=True, ensure_ascii=False) for a in y["adimlar"]))
    denetle("%s her carinin adım dizisi aynı" % ad, cari_dizisi(e) == cari_dizisi(y))
    denetle("%s elle beklenenler / üst alanlar aynı" % ad, {k: v for k, v in e.items() if k != "adimlar"} == {k: v for k, v in y.items() if k != "adimlar"})
    yerdegisen = sum(1 for a, b in zip(e["adimlar"], y["adimlar"]) if a != b)
    for mk in modeller:
        spec = importlib.util.spec_from_file_location("kahin_cari_g1_%d" % modeller.index(mk), os.path.join(mk, "model.py"))
        M = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(M)
        for kip in KIPLER:
            a = json.dumps(M.Model(json.loads(json.dumps(e)), 0, kip).kos(), ensure_ascii=False, sort_keys=True)
            b = json.dumps(M.Model(json.loads(json.dumps(y)), 0, kip).kos(), ensure_ascii=False, sort_keys=True)
            denetle("%s [%s] model %d çıktı bayt bayt aynı" % (ad, kip, modeller.index(mk) + 1), a == b, "(farklı)")
            ja = json.loads(a)
            dokum.append({"senaryo": ad, "model": mk, "kip": kip, "yeri_degisen_adim": yerdegisen, "eski_sha256": hashlib.sha256(a.encode()).hexdigest(),
                          "yeni_sha256": hashlib.sha256(b.encode()).hexdigest(), "denetim": len(ja["denetimler"]), "belirsiz": len(ja["belirsiz"]), "ayni": a == b})
print("G1 EŞDEĞERLİK (%d senaryo × %d model × %d kip): yeri değişen senaryoda kâhin çıktısı önce / sonra" % (len(adlar), len(modeller), len(KIPLER)))
for i, mk in enumerate(modeller):
    print("  model %d: %s" % (i + 1, mk))
for x in dokum:
    print("  %-34s %-6s model %d denetim %4d belirsiz %d · %s · eski %s… yeni %s…" % (x["senaryo"], x["kip"], modeller.index(x["model"]) + 1,
                                                                          x["denetim"], x["belirsiz"], "AYNI" if x["ayni"] else "FARKLI", x["eski_sha256"][:12], x["yeni_sha256"][:12]))
if DOKUM:
    with open(DOKUM, "w", encoding="utf-8") as f:
        json.dump(dokum, f, ensure_ascii=False, indent=1)
toplam = gecen + kalan
print("# tests %d" % toplam)
print("# pass %d" % gecen)
print("# fail %d" % kalan)
print("%d/%d denetim geçti" % (gecen, toplam))
sys.exit(0 if kalan == 0 else 1)
