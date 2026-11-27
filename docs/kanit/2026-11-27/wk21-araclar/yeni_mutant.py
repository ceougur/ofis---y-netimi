#!/usr/bin/env python3
"""Yeni mutantları (ya da verilenleri) tek tek koşar: her biri hangi senaryoda, hangi farkla yakalanıyor. Çıkış 1: yakalanmayan var.
Kullanım: python3 -I yeni_mutant.py <kahin klasörü> [M293 M294 …]"""
import sys


def main(klasor, adlar):
    sys.path.insert(0, klasor)
    import kahin  # noqa
    import kahin_test  # noqa
    if not adlar:
        adlar = [m for m in kahin.MUTASYONLAR if m[1:].isdigit() and 293 <= int(m[1:]) <= 400]
    kalan = 0
    for m in adlar:
        r = kahin_test.mutasyon_yakalar(m)
        if r is None:
            kalan += 1
            print(f"YAKALANMADI {m}: {kahin.MUTASYONLAR[m]}")
        else:
            print(f"yakalandı {m} ← {r[0]}: {r[1][:200]}")
    print(f"# mutant {len(adlar)}, yakalanan {len(adlar) - kalan}, yakalanmayan {kalan}")
    for k, v in (("tests", len(adlar)), ("pass", len(adlar) - kalan), ("fail", kalan), ("cancelled", 0), ("skipped", 0), ("todo", 0)):
        print(f"# {k} {v}")
    return 1 if kalan else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], sys.argv[2:]))
