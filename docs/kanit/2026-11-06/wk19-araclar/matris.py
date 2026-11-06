# WK 19 mutant matrisi: yeni mutantlar (M260–M277) × yeni / değişen senaryolar — DEĞERLE (elle beklenen farkı) mı, istisnayla mı yakalanıyor. TAP + özet.
# Kullanım: python3 -I matris.py <kahin klasörü> [--tum]   (--tum: bütün senaryolar)
import sys
sys.dont_write_bytecode = True
sys.path.insert(0, sys.argv[1])
import kahin, senaryolar

YENI_MUT = [f"M{i}" for i in range(260, 278)]
ONEK = ("S58-", "S59-", "S60-", "S61-", "S62-", "S63-", "S35-01", "S37-01", "S30-01", "S42-03")
tum = "--tum" in sys.argv
sen = [s for s in senaryolar.tum_senaryolar() if tum or s["ad"].startswith(ONEK)]
gecen = kalan = 0
satirlar = []
for m in YENI_MUT:
    deger = []; istisna = []
    for s in sen:
        try:
            b = kahin.hesapla(senaryolar.girdi(s), frozenset([m]))
        except Exception as e:
            istisna.append((s["ad"], f"{type(e).__name__}: {str(e)[:80]}"))
            continue
        f = senaryolar.elle_denetle(s, b)
        if f:
            deger.append((s["ad"], f[0][:160]))
    ok = bool(deger)
    gecen += ok; kalan += not ok
    satirlar.append(f"{'ok' if ok else 'not ok'} {len(satirlar) + 1} - {m} değerle {len(deger)} senaryo, istisna {len(istisna)} — {kahin.MUTASYONLAR[m][:90]}")
    for ad, n in deger:
        satirlar.append(f"  # değer {ad}: {n}")
    for ad, n in istisna:
        satirlar.append(f"  # İSTİSNA {ad}: {n}")
print("\n".join(satirlar))
print(f"1..{gecen + kalan}")
for ad, n in (("tests", gecen + kalan), ("pass", gecen), ("fail", kalan), ("cancelled", 0), ("skipped", 0), ("todo", 0)):
    print(f"# {ad} {n}")
sys.exit(0 if kalan == 0 else 1)
