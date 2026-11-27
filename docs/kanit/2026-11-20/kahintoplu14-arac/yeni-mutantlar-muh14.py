#!/usr/bin/env python3
"""Toplu kâhin bakımı 14 — yalnız bakım 14'ün yeni / taşınan mutantlarını koşar (öldürenleriyle). Kullanım: python3 -I -B yeni-mutantlar-muh14.py <muhasebe kâhini klasörü>"""
import os
import sys

K = os.path.abspath(sys.argv[1])
sys.path.insert(0, K)
import mutasyon as mu  # noqa: E402

ONEK = ("B128", "B129", "B130", "B131", "B07 ", "B41 ", "B41c")
src = open(os.path.join(K, "model.py"), encoding="utf-8").read()
n0, k0 = mu.kos(src)
print(f"temel: {n0} test, {len(k0)} kırmızı")
sag = 0
secilen = [(a, d) for a, d in mu.MUTANTLAR if a.startswith(ONEK)]
for ad, dg in secilen:
    n, kirmizi = mu.kos(mu.mutant_kaynak(src, dg))
    durum = "ÖLDÜ" if kirmizi else "SAĞ KALDI"
    sag += 0 if kirmizi else 1
    print(f"{ad:<90} {durum} ({len(kirmizi)}/{n}: {', '.join(kirmizi[:4])})")
mu.yukle(src)
print(f"# tests {len(secilen)}")
print(f"# pass {len(secilen) - sag}")
print(f"# fail {sag}")
sys.exit(1 if sag or k0 else 0)
