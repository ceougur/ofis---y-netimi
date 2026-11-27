#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""WK 18 aracı: verilen kâhin klasöründeki senaryoların (ad öneki) modelin TAM sonucunu kısaca yazar. Kullanım: python3 -I goster.py <kahin_klasoru> <önek> [M…]"""
import json
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, sys.argv[1])
import kahin  # noqa: E402
import senaryolar  # noqa: E402

onek = sys.argv[2]
mut = frozenset(sys.argv[3:])
for s in senaryolar.tum_senaryolar():
    if not s["ad"].startswith(onek):
        continue
    try:
        r = kahin.hesapla(senaryolar.girdi(s), mut)[0]["sonuc"]
    except Exception as e:  # noqa: BLE001
        print(s["ad"], "HATA", type(e).__name__, e)
        continue
    print("=====", s["ad"], sorted(mut))
    kisa = {k: r[k] for k in ("elenen", "olusmadi", "onceki_uyari", "toplular", "bu_ay", "yeniden", "kanca_yanitlari") if k in r}
    kisa["meta"] = r["meta"]["post"]
    kisa["isler"] = {a: {k: v for k, v in j.items() if k in ("durum", "post", "kabul", "atlanma_nedeni", "hata_kodu", "icerik_silindi", "telefon")} for a, j in r["isler"].items()}
    kisa["kontroller"] = {a: {"t": k["t"], "isler": k.get("isler"), "icerik_silindi": sorted(x for x, v in k.get("icerik", {}).items() if v.get("icerik_silindi"))}
                          for a, k in r["kontroller"].items()}
    print(json.dumps(kisa, ensure_ascii=False, sort_keys=True))
