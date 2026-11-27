#!/usr/bin/env python3
# WK 22: ESKİ kâhin (taban t251-wk21, değişiklikten önce alınmış kahin.py) ile YENİ senaryo dosyasının yeni / değişen senaryoları (5 SW21 + S23-04 + S29-03) — kırmızı ve NEDENİ (ders 7, 38).
# Kullanım: python3 -I <bu dosya> <eski kahin.py'nin klasörü> <yeni senaryolar.py'nin klasörü> <geçici klasör (benzersiz)>
import os
import shutil
import sys

eski_dir, yeni_dir, gecici = (os.path.abspath(x) for x in sys.argv[1:4])
os.makedirs(gecici, exist_ok=True)
shutil.copy(os.path.join(eski_dir, "kahin.py"), os.path.join(gecici, "kahin.py"))
shutil.copy(os.path.join(yeni_dir, "senaryolar.py"), os.path.join(gecici, "senaryolar.py"))
sys.path.insert(0, gecici)
import kahin       # noqa: E402  (ESKİ)
import senaryolar  # noqa: E402  (YENİ senaryolar, eski kâhinle)

hedef = [s for s in senaryolar.tum_senaryolar() if s["baslik"] == "SW21" or s["ad"].startswith(("S23-04", "S29-03"))]
kirmizi = 0
for s in hedef:
    try:
        b = kahin.hesapla(senaryolar.girdi(s))
    except Exception as e:
        kirmizi += 1
        print(f"KIRMIZI {s['ad'][:60]}: istisna {type(e).__name__}: {str(e)[:200]}")
        continue
    f = senaryolar.elle_denetle(s, b)
    if f:
        kirmizi += 1
        print(f"KIRMIZI {s['ad'][:60]}: {len(f)} fark; ilki {f[0][:260]}")
    else:
        print(f"YEŞİL (dişsiz!) {s['ad'][:60]}")
print(f"# eski kâhinle {len(hedef)} yeni / değişen senaryo: {kirmizi} KIRMIZI\n# tests {len(hedef)}\n# pass {kirmizi}\n# fail {len(hedef) - kirmizi}\n# cancelled 0\n# skipped 0\n# todo 0")
sys.exit(0 if kirmizi == len(hedef) else 1)
