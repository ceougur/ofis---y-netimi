#!/usr/bin/env python3
"""Eski kâhin (taban kopyası) ile yeni / değişen senaryolar: elle beklenen tutuyor mu (KIRMIZI beklenir — kural yoktu) ve nedeni.
Kullanım: python3 -I eski_kahin_yeni.py <taban klasörü (eski kahin.py)> <yeni kahin klasörü (senaryolar.py)>"""
import importlib.util
import json
import sys


def yukle(ad, yol):
    spec = importlib.util.spec_from_file_location(ad, yol)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def main(taban, yeni):
    eski = yukle("kahin_eski", taban + "/kahin.py")
    sys.modules["kahin"] = yukle("kahin", yeni + "/kahin.py")
    sen = yukle("senaryolar_yeni", yeni + "/senaryolar.py")
    secili = [s for s in sen.SENARYOLAR if s["baslik"].startswith("C5C") or s["ad"].startswith(("S23-04", "S29-03"))]
    kirmizi = 0
    for s in secili:
        try:
            b = eski.hesapla(sen.girdi(s))
        except Exception as e:  # noqa
            kirmizi += 1
            print(f"KIRMIZI (istisna) {s['ad']}: {type(e).__name__}: {str(e)[:200]}")
            continue
        farklar = []
        for kismi, yollar in s["elle"]:
            for yol, deger in yollar.items():
                m = eski.yol_al(b[0]["sonuc"], yol)
                if json.dumps(m, sort_keys=True, ensure_ascii=False) != json.dumps(deger, sort_keys=True, ensure_ascii=False):
                    farklar.append(f"{yol}: elle {json.dumps(deger, ensure_ascii=False)[:140]} ≠ eski {json.dumps(m, ensure_ascii=False)[:140]}")
        if farklar:
            kirmizi += 1
            print(f"KIRMIZI {s['ad']} ({len(farklar)} yaprak): " + " | ".join(farklar[:3]))
        else:
            print(f"AYNI {s['ad']}")
    print(f"# senaryo {len(secili)}, KIRMIZI {kirmizi}, AYNI {len(secili) - kirmizi}")
    # "pass" = beklenen yönde (eski kâhinde KIRMIZI: kural / girdi yoktu); AYNI çıkan "fail" (dişsiz senaryo)
    for k, v in (("tests", len(secili)), ("pass", kirmizi), ("fail", len(secili) - kirmizi), ("cancelled", 0), ("skipped", 0), ("todo", 0)):
        print(f"# {k} {v}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], sys.argv[2]))
