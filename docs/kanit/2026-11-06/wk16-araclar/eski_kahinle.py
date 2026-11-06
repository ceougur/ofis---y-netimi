#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""WK 16 — eski kâhinle (taban ee344d86, değişiklikten ÖNCE alınmış kopya) yeni / değişen senaryolar.

Kullanım: python3 -I eski_kahinle.py <eski kahin.py> <yeni senaryolar.json> [--notr]
  --notr: eski kâhinin YALNIZ "KULLANICIYA SORULMALI S23-a / S-W3-a / S-W3-b" hata satırları etkisiz (raise → `None and …`) bellek kopyası — karar yokken
          düşülecek yol (ders 38: kırmızının nedeni değerle görülsün). Kural EKLENMEZ.
Girdi + elle beklenen yeni senaryolar.json'dan okunur (senaryolar.py yeni kâhini içe aktardığı için kullanılmaz).
"""
import importlib.util
import json
import sys
import types

YENI = ("S29-", "S30-", "S31-", "S32-")
DEGISEN = ("S23-05-", "SW3-05-")


def yukle(yol, notr):
    kaynak = open(yol, encoding="utf-8").read()
    if notr:
        n = 0
        for parca in ('raise ValueError("KULLANICIYA SORULMALI S23-a', 'raise ValueError("KULLANICIYA SORULMALI S-W3-a', 'raise ValueError("KULLANICIYA SORULMALI S-W3-b'):
            n += kaynak.count(parca)
            kaynak = kaynak.replace(parca, "None and ValueError(\"KULLANICIYA SORULMALI " + parca.split("SORULMALI ")[1])
        if n != 3:
            raise SystemExit(f"nötr kopya: 3 hata satırı bekleniyordu, {n} bulundu")
    m = types.ModuleType("kahin_eski")
    m.__file__ = yol
    exec(compile(kaynak, yol, "exec"), m.__dict__)
    return m


def esit(a, b):
    return json.dumps(a, sort_keys=True, ensure_ascii=False) == json.dumps(b, sort_keys=True, ensure_ascii=False)


def main(argv):
    notr = "--notr" in argv
    argv = [a for a in argv if a != "--notr"]
    k = yukle(argv[0], notr)
    veri = json.load(open(argv[1], encoding="utf-8"))
    kirmizi = ayni = 0
    for s in veri["senaryolar"]:
        if not s["ad"].startswith(YENI + DEGISEN):
            continue
        girdi = dict(s["girdi"], ad=s["ad"])
        try:
            b = k.hesapla(girdi)
        except Exception as e:  # noqa: BLE001 — neden yazılır
            kirmizi += 1
            print(f"KIRMIZI {s['ad']}: istisna {type(e).__name__}: {str(e)[:220]}")
            continue
        farklar = []
        for e_ in s["elle"]:
            for yol, deger in e_["yollar"].items():
                m = k.yol_al(b[0]["sonuc"], yol)
                if not esit(m, deger):
                    farklar.append(f"{yol}: elle {json.dumps(deger, ensure_ascii=False)[:150]} ≠ eski {json.dumps(m, ensure_ascii=False)[:150]}")
        tam = esit(b, s["beklenen"])
        if farklar:
            kirmizi += 1
            print(f"KIRMIZI {s['ad']}: {len(farklar)} elle yaprağı farklı (değerle)")
            for f in farklar[:8]:
                print(f"    {f}")
        else:
            ayni += 1
            print(f"AYNI {s['ad']} (elle yaprakları eşit; tam sonuç {'eşit' if tam else 'FARKLI'})")
    print(f"# {'nötr kopya' if notr else 'eski kâhin'}: KIRMIZI {kirmizi}, AYNI {ayni}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
