#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""WK 18 aracı: mutant matrisi — her mutantın verilen senaryolarda elle beklenene DEĞERLE mi (fark), İSTİSNAYLA mı takıldığını ya da AYNI mı kaldığını yazar.
Kullanım: python3 -I mutant_matrisi.py <kahin_klasoru> <senaryo önekleri virgüllü> <mutantlar virgüllü | "yeni">"""
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, sys.argv[1])
import kahin  # noqa: E402
import senaryolar  # noqa: E402

onekler = sys.argv[2].split(",")
mutler = [f"M{i}" for i in range(251, 260)] if sys.argv[3] == "yeni" else sys.argv[3].split(",")
secilen = [s for s in senaryolar.tum_senaryolar() if any(s["ad"].startswith(o) for o in onekler)]
print(f"senaryo {len(secilen)}, mutant {len(mutler)}")
toplam_deger = {}
for m in mutler:
    satir = []
    for s in secilen:
        try:
            b = kahin.hesapla(senaryolar.girdi(s), frozenset([m]))
        except Exception as e:  # noqa: BLE001
            satir.append((s["ad"][:7], "İSTİSNA " + type(e).__name__ + ": " + str(e)[:90]))
            continue
        f = senaryolar.elle_denetle(s, b)
        satir.append((s["ad"][:7], f"DEĞER ({len(f)} yaprak) — {f[0][len(s['ad']) + 1:][:150]}" if f else "aynı"))
    n = sum(1 for _a, d in satir if d.startswith("DEĞER"))
    toplam_deger[m] = n
    print(f"{m} ({kahin.MUTASYONLAR.get(m, '?')[:110]}): DEĞERLE {n} senaryo")
    for a, d in satir:
        if d != "aynı":
            print(f"   {a}: {d}")
eksik = [m for m, n in toplam_deger.items() if n == 0]
print("DEĞERLE YAKALANMAYAN:", eksik if eksik else "YOK")
for ad_, n_ in (("tests", len(mutler)), ("pass", len(mutler) - len(eksik)), ("fail", len(eksik)), ("cancelled", 0), ("skipped", 0), ("todo", 0)):
    print(f"# {ad_} {n_}")
sys.exit(1 if eksik else 0)
