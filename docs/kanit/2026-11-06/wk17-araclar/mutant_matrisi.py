#!/usr/bin/env python3
"""WK 17 mutant matrisi: yeni / değişen senaryolar × mutantlar — DEĞERLE (elle beklenen) mi, istisnayla mı yakalanıyor.
Kullanım: python3 -I mutant_matrisi.py <kahin klasörü>"""
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, sys.argv[1])
import kahin  # noqa: E402
import senaryolar  # noqa: E402

YENI = ("S34", "S35", "S36", "S37", "S38", "S33", "S41")
DEGISEN = ("S16-02", "S30-01", "S30-02", "S30-03")
MUTANTLAR = [f"M{n}" for n in range(236, 251)] + ["M200", "M24", "M102", "M114", "M198", "M218", "M225", "M226", "M227", "M228", "M229",
                                                    "M230", "M231", "M232", "M233", "M234", "M235", "M215", "M219", "M221"]
secili = [s for s in senaryolar.SENARYOLAR if s["baslik"] in YENI or any(s["ad"].startswith(d) for d in DEGISEN)]
print(f"senaryo {len(secili)}; mutant {len(MUTANTLAR)}")
eksik = []
for m in MUTANTLAR:
    deger, istisna = [], []
    for s in secili:
        try:
            b = kahin.hesapla(senaryolar.girdi(s), frozenset([m]))
        except Exception as e:  # noqa: BLE001
            istisna.append(f"{s['ad'][:7]}({type(e).__name__})")
            continue
        if senaryolar.elle_denetle(s, b):
            deger.append(s["ad"][:7])
    print(f"{m}: değerle {len(deger)} {deger} | istisnayla {len(istisna)} {istisna}")
    if m >= "M236" and len(m) == 4 and not deger:
        eksik.append(m)
print("DEĞERLE YAKALANMAYAN YENİ MUTANT: " + (", ".join(eksik) if eksik else "YOK"))
sys.exit(1 if eksik else 0)
