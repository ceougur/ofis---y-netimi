# -*- coding: utf-8 -*-
"""WK13: ESKİ kâhin (taban e6e5610f'nin değişiklikten önce alınmış kopyası) ile YENİ senaryolar (girdi + elle beklenen).
Kullanım: python3 -I eski_yeni.py <eski kahin klasörü> <yeni kahin klasörü> <başlık> ...
Eski kahin modülü önce yüklenir; yeni senaryolar.py'nin 'import kahin'i önbellekteki ESKİ modülü alır."""
import sys
sys.dont_write_bytecode = True
sys.path.insert(0, sys.argv[1])
import kahin  # noqa: E402  (ESKİ)
eski_yol = kahin.__file__
sys.path.insert(0, sys.argv[2])
import senaryolar  # noqa: E402  (YENİ senaryolar; kahin önbellekten ESKİ)
assert kahin.__file__ == eski_yol, "eski kahin yüklenmedi"
print("eski kahin:", eski_yol)
basliklar = set(sys.argv[3:])
kirmizi = ayni = 0
for s in senaryolar.tum_senaryolar():
    if s["baslik"] not in basliklar:
        continue
    try:
        b = kahin.hesapla(senaryolar.girdi(s))
        f = senaryolar.elle_denetle(s, b)
    except Exception as e:  # noqa: BLE001
        f = [f"İSTİSNA {type(e).__name__}: {str(e)[:220]}"]
    if f:
        kirmizi += 1
        print(f"KIRMIZI {s['ad']} ({len(f)} fark)")
        for x in f[:6]:
            print("   ", x[:330])
    else:
        ayni += 1
        print(f"AYNI    {s['ad']}")
print(f"yeni senaryo: {kirmizi + ayni}; KIRMIZI {kirmizi}; AYNI {ayni}")
