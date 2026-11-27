#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""WK 15: yeni mutantların (M213–M222) yeni senaryolarda (S23, SW3 başlıkları) yakalanma matrisi.
Hücre: DEĞER (elle beklenen ≠ mutant modeli; ilk fark yazılır) / İSTİSNA (mutant modeli düşer) / aynı.
Özet satırları (kanit.mjs): tests = mutant sayısı, pass = en az bir senaryoda DEĞERLE yakalanan, fail = değerle yakalanmayan.
Kullanım: python3 -I mutant_matrisi.py <kahin klasörü>"""
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, sys.argv[1])
import kahin  # noqa: E402
import senaryolar  # noqa: E402

YENI = [f"M{n}" for n in range(213, 223)]
yeni_s = [s for s in senaryolar.SENARYOLAR if s["baslik"] in ("S23", "SW3")]
toplam_deger = 0
for m in YENI:
    print(f"== {m}: {kahin.MUTASYONLAR[m]}")
    deger = istisna = 0
    for s in yeni_s:
        try:
            b = kahin.hesapla(senaryolar.girdi(s), frozenset([m]))
        except Exception as e:  # noqa: BLE001
            istisna += 1
            print(f"   İSTİSNA {s['ad']}: {type(e).__name__}: {str(e)[:140]}")
            continue
        f = senaryolar.elle_denetle(s, b)
        if f:
            deger += 1
            print(f"   DEĞER   {s['ad']}: {len(f)} fark — {f[0][len(s['ad']) + 1:][:200]}")
        else:
            print(f"   aynı    {s['ad']}")
    toplam_deger += 1 if deger else 0
    print(f"   → değerle {deger}, istisnayla {istisna}, {len(yeni_s)} senaryodan")
print(f"değerle yakalanan mutant {toplam_deger}/{len(YENI)}")
print(f"1..{len(YENI)}")
for ad_, n_ in (("tests", len(YENI)), ("pass", toplam_deger), ("fail", len(YENI) - toplam_deger), ("cancelled", 0), ("skipped", 0), ("todo", 0)):
    print(f"# {ad_} {n_}")
sys.exit(0 if toplam_deger == len(YENI) else 1)
